import {
  AppState,
  NativeEventSubscription,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import {
  CONNECT_TIMEOUT_MS,
  DEVICE_NAME,
  RECONNECT_DIRECT_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  REQUESTED_MTU,
  SCAN_TIMEOUT_MS,
  UART_RX_CHAR_UUID,
  UART_SERVICE_UUID,
} from '../constants/ble';
import { ConnectionStatus, DspPayload } from '../types';

export type BleErrorContext =
  | 'permissions'
  | 'adapter'
  | 'scan'
  | 'connect'
  | 'reconnect'
  | 'write';

export interface BleErrorEvent {
  context: BleErrorContext;
  /** True when the error came from a user-initiated action and warrants a visible alert. */
  userInitiated: boolean;
  message: string;
}

export interface BleListenerHandle {
  remove: () => void;
}

type StatusListener = (status: ConnectionStatus) => void;
type QueueListener = (count: number) => void;
type ErrorListener = (event: BleErrorEvent) => void;

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : 23;

  if (sdkVersion >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Owns the BleManager singleton and the full connection lifecycle:
 *
 * - Scan → connect → verify Nordic UART service.
 * - Automatic reconnection with exponential backoff after unexpected drops
 *   (direct reconnect by id first, scan fallback after RECONNECT_DIRECT_ATTEMPTS).
 * - Coalescing offline queue: every payload is staged by type (latest wins) and
 *   drained over a serialized write chain the moment the link is up.
 * - Reacts to adapter power cycles and app foregrounding to retry immediately.
 *
 * Pure TypeScript, no React — UI layers subscribe via the on*() listener methods.
 */
export class BleConnectionManager {
  private readonly manager = new BleManager();

  private status: ConnectionStatus = 'idle';
  private device: Device | null = null;
  private lastDeviceId: string | null = null;

  /** Re-engage the link after unexpected drops; false until a user-initiated connect succeeds. */
  private autoReconnect = false;

  /** Bumped on every user connect/disconnect to invalidate in-flight async work. */
  private generation = 0;

  /** Unsent payloads, one slot per payload type — latest write wins. */
  private readonly queue = new Map<DspPayload['type'], DspPayload>();
  /** Serializes GATT writes so payloads never interleave on the wire. */
  private writeChain: Promise<void> = Promise.resolve();

  private disconnectSub: Subscription | null = null;
  private adapterStateSub: Subscription | null = null;
  private appStateSub: NativeEventSubscription | null = null;

  private cancelScan: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectWake: (() => void) | null = null;

  private readonly statusListeners = new Set<StatusListener>();
  private readonly queueListeners = new Set<QueueListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  constructor() {
    this.adapterStateSub = this.manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        // Retry immediately instead of waiting out the backoff timer.
        this.wakeReconnect();
      } else if (state === State.PoweredOff) {
        this.handleUnexpectedDisconnect();
      }
    }, false);

    this.appStateSub = AppState.addEventListener('change', (appState) => {
      // iOS suspends JS timers in the background; kick the loop on return.
      if (appState === 'active') this.wakeReconnect();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getQueuedCount(): number {
    return this.queue.size;
  }

  onStatusChange(listener: StatusListener): BleListenerHandle {
    this.statusListeners.add(listener);
    return { remove: () => this.statusListeners.delete(listener) };
  }

  onQueueChange(listener: QueueListener): BleListenerHandle {
    this.queueListeners.add(listener);
    return { remove: () => this.queueListeners.delete(listener) };
  }

  onError(listener: ErrorListener): BleListenerHandle {
    this.errorListeners.add(listener);
    return { remove: () => this.errorListeners.delete(listener) };
  }

  /** User-initiated connect: permissions → adapter check → scan → connect. */
  async connect(): Promise<void> {
    if (this.status === 'reconnecting') {
      this.wakeReconnect();
      return;
    }
    if (this.status !== 'idle' && this.status !== 'disconnected') return;

    const gen = ++this.generation;

    const granted = await requestBlePermissions().catch(() => false);
    if (gen !== this.generation) return;
    if (!granted) {
      this.emitError('permissions', true, 'Bluetooth permissions are required to connect to Haven.');
      return;
    }

    const adapterState = await this.manager.state();
    if (gen !== this.generation) return;
    if (adapterState !== State.PoweredOn) {
      this.emitError('adapter', true, 'Please enable Bluetooth and try again.');
      return;
    }

    try {
      this.setStatus('scanning');
      const found = await this.scanForDevice();
      if (gen !== this.generation) return;

      this.setStatus('connecting');
      await this.establishConnection(found.id, gen);
    } catch (err) {
      if (gen !== this.generation) return;
      this.setStatus('disconnected');
      this.emitError('connect', true, errorMessage(err));
    }
  }

  /** User-initiated disconnect: tears down the link and stops any reconnect loop. */
  async disconnect(): Promise<void> {
    this.generation++;
    this.autoReconnect = false;
    this.cancelScan?.();
    this.wakeReconnect();

    this.disconnectSub?.remove();
    this.disconnectSub = null;

    const device = this.device;
    this.device = null;
    if (device) {
      await this.manager.cancelDeviceConnection(device.id).catch(() => {});
    }
    this.setStatus('idle');
  }

  /**
   * Stage a payload and flush immediately when connected. While disconnected the
   * payload is queued (latest per type wins) and blasted the moment the board
   * reconnects.
   */
  send(payload: DspPayload): void {
    this.queue.delete(payload.type);
    this.queue.set(payload.type, payload);
    this.emitQueueChange();

    if (this.status === 'connected') this.flushQueue();
  }

  /** Releases every native resource. Only for app teardown/tests. */
  destroy(): void {
    this.generation++;
    this.autoReconnect = false;
    this.cancelScan?.();
    this.wakeReconnect();
    this.disconnectSub?.remove();
    this.adapterStateSub?.remove();
    this.appStateSub?.remove();
    this.statusListeners.clear();
    this.queueListeners.clear();
    this.errorListeners.clear();
    this.manager.destroy();
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  private scanForDevice(): Promise<Device> {
    return new Promise<Device>((resolve, reject) => {
      let settled = false;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.cancelScan = null;
        this.manager.stopDeviceScan();
        settle();
      };

      const timeout = setTimeout(
        () => finish(() => reject(new Error(`Could not find "${DEVICE_NAME}" nearby.`))),
        SCAN_TIMEOUT_MS,
      );
      this.cancelScan = () => finish(() => reject(new Error('Scan cancelled.')));

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          finish(() => reject(error));
          return;
        }
        if (device && (device.localName === DEVICE_NAME || device.name === DEVICE_NAME)) {
          finish(() => resolve(device));
        }
      });
    });
  }

  private async establishConnection(deviceId: string, gen: number): Promise<void> {
    const device = await this.manager.connectToDevice(deviceId, {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await device.discoverAllServicesAndCharacteristics();

    const services = await device.services();
    const hasUart = services.some(
      (s) => s.uuid.toUpperCase() === UART_SERVICE_UUID.toUpperCase(),
    );
    if (!hasUart) {
      await device.cancelConnection().catch(() => {});
      throw new Error('Nordic UART Service not found on device.');
    }

    if (Platform.OS === 'android') {
      await device.requestMTU(REQUESTED_MTU).catch(() => {});
    }

    if (gen !== this.generation) {
      await device.cancelConnection().catch(() => {});
      return;
    }

    this.device = device;
    this.lastDeviceId = device.id;
    this.autoReconnect = true;

    this.disconnectSub?.remove();
    this.disconnectSub = this.manager.onDeviceDisconnected(device.id, () =>
      this.handleUnexpectedDisconnect(),
    );

    this.setStatus('connected');
    this.flushQueue();
  }

  private handleUnexpectedDisconnect(): void {
    if (this.status !== 'connected') return;

    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.device = null;

    if (this.autoReconnect) {
      void this.runReconnectLoop();
    } else {
      this.setStatus('disconnected');
    }
  }

  private async runReconnectLoop(): Promise<void> {
    const gen = ++this.generation;
    this.setStatus('reconnecting');

    for (let attempt = 1; gen === this.generation && this.autoReconnect; attempt++) {
      try {
        const adapterState = await this.manager.state();
        if (gen !== this.generation) return;
        if (adapterState !== State.PoweredOn) {
          throw new Error('Bluetooth is powered off.');
        }

        let targetId = this.lastDeviceId;
        if (!targetId || attempt > RECONNECT_DIRECT_ATTEMPTS) {
          const found = await this.scanForDevice();
          targetId = found.id;
        }
        if (gen !== this.generation) return;

        await this.establishConnection(targetId, gen);
        return;
      } catch (err) {
        if (gen !== this.generation) return;
        this.emitError('reconnect', false, errorMessage(err));

        const delay = Math.min(
          RECONNECT_INITIAL_DELAY_MS * 2 ** Math.min(attempt - 1, 10),
          RECONNECT_MAX_DELAY_MS,
        );
        await this.sleepInterruptible(delay);
      }
    }
  }

  /** Backoff sleep that adapter power-on, app foregrounding, or disconnect() can cut short. */
  private sleepInterruptible(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.reconnectWake = () => {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnectWake = null;
        resolve();
      };
      this.reconnectTimer = setTimeout(() => this.reconnectWake?.(), ms);
    });
  }

  private wakeReconnect(): void {
    this.reconnectWake?.();
  }

  // ── Payload queue ─────────────────────────────────────────────────────────

  private flushQueue(): void {
    this.writeChain = this.writeChain.then(() => this.drainQueue());
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.size > 0) {
      const device = this.device;
      if (!device || this.status !== 'connected') return;

      const next = this.queue.entries().next();
      if (next.done) return;
      const [type, payload] = next.value;

      try {
        // Firmware frames messages on '\n' — every payload must end with one.
        await device.writeCharacteristicWithResponseForService(
          UART_SERVICE_UUID,
          UART_RX_CHAR_UUID,
          encodeBase64(JSON.stringify(payload) + '\n'),
        );
        // Drop only if it wasn't replaced by a newer payload mid-write.
        if (this.queue.get(type) === payload) {
          this.queue.delete(type);
          this.emitQueueChange();
        }
      } catch (err) {
        // Payload stays queued; a link drop triggers the reconnect loop, a
        // transient error is retried on the next send() or reconnect flush.
        this.emitError('write', false, errorMessage(err));
        return;
      }
    }
  }

  // ── Listener plumbing ─────────────────────────────────────────────────────

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private emitQueueChange(): void {
    const count = this.queue.size;
    this.queueListeners.forEach((listener) => listener(count));
  }

  private emitError(context: BleErrorContext, userInitiated: boolean, message: string): void {
    const event: BleErrorEvent = { context, userInitiated, message };
    this.errorListeners.forEach((listener) => listener(event));
  }
}

let shared: BleConnectionManager | null = null;

/** Lazily created app-wide singleton — the BleManager must never be recreated. */
export function getBleConnectionManager(): BleConnectionManager {
  if (!shared) shared = new BleConnectionManager();
  return shared;
}
