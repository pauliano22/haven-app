import {
  AppState,
  NativeEventSubscription,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import {
  BENCH_AUDIO_SERVICE_UUID,
  BENCH_FREQ_RANGE_CHAR_UUID,
  BENCH_VOLUME_CHAR_UUID,
  CONNECT_TIMEOUT_MS,
  DEVICE_NAME,
  RECONNECT_DIRECT_ATTEMPTS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  REQUESTED_MTU,
  SCAN_TIMEOUT_MS,
  UART_RX_CHAR_UUID,
  UART_SERVICE_UUID,
  UART_TX_CHAR_UUID,
} from '../constants/ble';
import {
  BenchFreqRange,
  ConnectionStatus,
  DeviceBootInfo,
  DeviceMessage,
  DspPayload,
} from '../types';
import { LineBuffer, parseDeviceLine } from '../utils/deviceMessages';

export type BleErrorContext =
  | 'permissions'
  | 'adapter'
  | 'scan'
  | 'connect'
  | 'reconnect'
  | 'write'
  | 'bench-write';

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
type DeviceMessageListener = (message: DeviceMessage) => void;
type DeviceInfoListener = (info: DeviceBootInfo | null) => void;
type BenchAvailableListener = (available: boolean) => void;
type BenchVolumeListener = (percent: number) => void;
type BenchFreqRangeListener = (range: BenchFreqRange) => void;

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function bytesToBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): number[] {
  const binary = atob(b64);
  return Array.from(binary, (ch) => ch.charCodeAt(0));
}

/** Inverse of encodeBase64: base64 → UTF-8 text (NUS TX lines are UTF-8 JSON). */
function base64ToUtf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

function decodeFreqRangeBytes(bytes: number[]): BenchFreqRange {
  return {
    lowerHz: bytes[0] | (bytes[1] << 8),
    upperHz: bytes[2] | (bytes[3] << 8),
  };
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
 * - Subscribes to NUS TX and turns the device's newline-framed JSON acks and
 *   events into typed DeviceMessages (docs/ble-protocol.md, "Messages
 *   (device → app)"). Acks are confirmation only — the queue above never waits
 *   on them.
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

  // ── Device → app messages over NUS TX ────────────────────────────────────
  private nusTxSub: Subscription | null = null;
  private readonly rxLines = new LineBuffer();
  /** The connected firmware's boot event; null until it arrives / after disconnect. */
  private deviceInfo: DeviceBootInfo | null = null;
  private readonly deviceMessageListeners = new Set<DeviceMessageListener>();
  private readonly deviceInfoListeners = new Set<DeviceInfoListener>();

  // ── nRF5340 DK bench firmware only (Haven Audio Control Service) ─────────
  private benchAvailable = false;
  private benchVolume: number | null = null;
  private benchFreqRange: BenchFreqRange | null = null;
  private benchVolumeSub: Subscription | null = null;
  private benchFreqRangeSub: Subscription | null = null;
  private readonly benchAvailableListeners = new Set<BenchAvailableListener>();
  private readonly benchVolumeListeners = new Set<BenchVolumeListener>();
  private readonly benchFreqRangeListeners = new Set<BenchFreqRangeListener>();

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

  // ── Device → app messages ────────────────────────────────────────────────

  /** Boot announcement of the connected firmware (fw version, DAC source), or null. */
  getDeviceInfo(): DeviceBootInfo | null {
    return this.deviceInfo;
  }

  /**
   * Every ack and event the device sends, in arrival order. Fires once per
   * line; unparsable or unknown lines are dropped silently (forward-compatible).
   */
  onDeviceMessage(listener: DeviceMessageListener): BleListenerHandle {
    this.deviceMessageListeners.add(listener);
    return { remove: () => this.deviceMessageListeners.delete(listener) };
  }

  onDeviceInfoChange(listener: DeviceInfoListener): BleListenerHandle {
    this.deviceInfoListeners.add(listener);
    return { remove: () => this.deviceInfoListeners.delete(listener) };
  }

  // ── nRF5340 DK bench firmware only ───────────────────────────────────────

  isBenchAvailable(): boolean {
    return this.benchAvailable;
  }

  getBenchVolume(): number | null {
    return this.benchVolume;
  }

  getBenchFreqRange(): BenchFreqRange | null {
    return this.benchFreqRange;
  }

  onBenchAvailableChange(listener: BenchAvailableListener): BleListenerHandle {
    this.benchAvailableListeners.add(listener);
    return { remove: () => this.benchAvailableListeners.delete(listener) };
  }

  onBenchVolumeChange(listener: BenchVolumeListener): BleListenerHandle {
    this.benchVolumeListeners.add(listener);
    return { remove: () => this.benchVolumeListeners.delete(listener) };
  }

  onBenchFreqRangeChange(listener: BenchFreqRangeListener): BleListenerHandle {
    this.benchFreqRangeListeners.add(listener);
    return { remove: () => this.benchFreqRangeListeners.delete(listener) };
  }

  /** Resolves once the board accepts the write; rejects (out-of-range, etc.) otherwise. */
  async setBenchVolume(percent: number): Promise<void> {
    const device = this.device;
    if (!device || !this.benchAvailable) {
      throw new Error('Bench controls are not available on this connection.');
    }
    try {
      await device.writeCharacteristicWithResponseForService(
        BENCH_AUDIO_SERVICE_UUID,
        BENCH_VOLUME_CHAR_UUID,
        bytesToBase64([Math.round(percent)]),
      );
      // The board notifies the accepted value back; the monitor picks it up.
      // Setting it here too covers devices/OSes that don't echo a self-write.
      this.setBenchVolumeValue(Math.round(percent));
    } catch (err) {
      this.emitError('bench-write', true, errorMessage(err));
      throw err;
    }
  }

  /** Resolves once the board accepts the write; rejects (out-of-range, etc.) otherwise. */
  async setBenchFreqRange(range: BenchFreqRange): Promise<void> {
    const device = this.device;
    if (!device || !this.benchAvailable) {
      throw new Error('Bench controls are not available on this connection.');
    }
    const lower = Math.round(range.lowerHz);
    const upper = Math.round(range.upperHz);
    const wire = [lower & 0xff, (lower >> 8) & 0xff, upper & 0xff, (upper >> 8) & 0xff];

    try {
      await device.writeCharacteristicWithResponseForService(
        BENCH_AUDIO_SERVICE_UUID,
        BENCH_FREQ_RANGE_CHAR_UUID,
        bytesToBase64(wire),
      );
      this.setBenchFreqRangeValue({ lowerHz: lower, upperHz: upper });
    } catch (err) {
      this.emitError('bench-write', true, errorMessage(err));
      throw err;
    }
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
    this.teardownDeviceMessages();
    this.teardownBenchControls();

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
    this.teardownDeviceMessages();
    this.teardownBenchControls();
    this.statusListeners.clear();
    this.queueListeners.clear();
    this.errorListeners.clear();
    this.deviceMessageListeners.clear();
    this.deviceInfoListeners.clear();
    this.benchAvailableListeners.clear();
    this.benchVolumeListeners.clear();
    this.benchFreqRangeListeners.clear();
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

    const hasBenchService = services.some(
      (s) => s.uuid.toUpperCase() === BENCH_AUDIO_SERVICE_UUID.toUpperCase(),
    );

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

    // Subscribe to NUS TX before anything is written, so the very first ack
    // (and the boot event the firmware sends on connect) is never missed.
    this.setupDeviceMessages(device);

    this.setStatus('connected');
    this.flushQueue();

    // Bench firmware only (haven-zephyr-app's Haven Audio Control Service) —
    // absent on production hardware, so its absence here is normal, not an error.
    if (hasBenchService) {
      await this.setupBenchControls(device).catch((err) => {
        this.emitError('bench-write', false, errorMessage(err));
      });
    } else {
      this.setBenchAvailable(false);
    }
  }

  private async setupBenchControls(device: Device): Promise<void> {
    const [volumeChar, freqChar] = await Promise.all([
      device.readCharacteristicForService(BENCH_AUDIO_SERVICE_UUID, BENCH_VOLUME_CHAR_UUID),
      device.readCharacteristicForService(BENCH_AUDIO_SERVICE_UUID, BENCH_FREQ_RANGE_CHAR_UUID),
    ]);

    if (this.device !== device) return; // superseded by a disconnect/reconnect mid-read

    this.setBenchAvailable(true);
    if (volumeChar.value) this.setBenchVolumeValue(base64ToBytes(volumeChar.value)[0]);
    if (freqChar.value) this.setBenchFreqRangeValue(decodeFreqRangeBytes(base64ToBytes(freqChar.value)));

    this.benchVolumeSub?.remove();
    this.benchVolumeSub = device.monitorCharacteristicForService(
      BENCH_AUDIO_SERVICE_UUID,
      BENCH_VOLUME_CHAR_UUID,
      (error, char) => {
        if (error || !char?.value) return;
        this.setBenchVolumeValue(base64ToBytes(char.value)[0]);
      },
    );

    this.benchFreqRangeSub?.remove();
    this.benchFreqRangeSub = device.monitorCharacteristicForService(
      BENCH_AUDIO_SERVICE_UUID,
      BENCH_FREQ_RANGE_CHAR_UUID,
      (error, char) => {
        if (error || !char?.value) return;
        this.setBenchFreqRangeValue(decodeFreqRangeBytes(base64ToBytes(char.value)));
      },
    );
  }

  // ── Device → app messages (NUS TX) ───────────────────────────────────────

  private setupDeviceMessages(device: Device): void {
    this.nusTxSub?.remove();
    this.rxLines.reset();
    this.setDeviceInfo(null);

    this.nusTxSub = device.monitorCharacteristicForService(
      UART_SERVICE_UUID,
      UART_TX_CHAR_UUID,
      (error, char) => {
        if (error || !char?.value) return;
        if (this.device !== device) return; // stale subscription from a previous link
        let text: string;
        try {
          text = base64ToUtf8(char.value);
        } catch {
          return; // not valid base64/UTF-8 — nothing this app can use
        }
        for (const line of this.rxLines.feed(text)) {
          const message = parseDeviceLine(line);
          if (message) this.handleDeviceMessage(message);
        }
      },
    );
  }

  private teardownDeviceMessages(): void {
    this.nusTxSub?.remove();
    this.nusTxSub = null;
    this.rxLines.reset();
    this.setDeviceInfo(null);
  }

  private handleDeviceMessage(message: DeviceMessage): void {
    if (message.kind === 'event' && message.event === 'boot') {
      this.setDeviceInfo({
        fw: message.fw,
        fdspRate: message.fdspRate,
        dacSource: message.dacSource,
      });
    }
    this.deviceMessageListeners.forEach((listener) => listener(message));
  }

  private setDeviceInfo(info: DeviceBootInfo | null): void {
    const prev = this.deviceInfo;
    if (prev === info) return;
    if (
      prev &&
      info &&
      prev.fw === info.fw &&
      prev.fdspRate === info.fdspRate &&
      prev.dacSource === info.dacSource
    ) {
      return;
    }
    this.deviceInfo = info;
    this.deviceInfoListeners.forEach((listener) => listener(info));
  }

  private teardownBenchControls(): void {
    this.benchVolumeSub?.remove();
    this.benchVolumeSub = null;
    this.benchFreqRangeSub?.remove();
    this.benchFreqRangeSub = null;
    this.setBenchAvailable(false);
  }

  private handleUnexpectedDisconnect(): void {
    if (this.status !== 'connected') return;

    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.device = null;
    this.teardownDeviceMessages();
    this.teardownBenchControls();

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

  private setBenchAvailable(available: boolean): void {
    if (this.benchAvailable === available) return;
    this.benchAvailable = available;
    if (!available) {
      this.benchVolume = null;
      this.benchFreqRange = null;
    }
    this.benchAvailableListeners.forEach((listener) => listener(available));
  }

  private setBenchVolumeValue(percent: number): void {
    if (this.benchVolume === percent) return;
    this.benchVolume = percent;
    this.benchVolumeListeners.forEach((listener) => listener(percent));
  }

  private setBenchFreqRangeValue(range: BenchFreqRange): void {
    const prev = this.benchFreqRange;
    if (prev && prev.lowerHz === range.lowerHz && prev.upperHz === range.upperHz) return;
    this.benchFreqRange = range;
    this.benchFreqRangeListeners.forEach((listener) => listener(range));
  }
}

let shared: BleConnectionManager | null = null;

/** Lazily created app-wide singleton — the BleManager must never be recreated. */
export function getBleConnectionManager(): BleConnectionManager {
  if (!shared) shared = new BleConnectionManager();
  return shared;
}
