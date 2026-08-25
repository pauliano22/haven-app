import {
  BENCH_AUDIO_SERVICE_UUID,
  BENCH_FREQ_RANGE_CHAR_UUID,
  BENCH_VOLUME_CHAR_UUID,
  DEVICE_NAME,
} from '../constants/ble';
import { BenchFreqRange, ConnectionStatus } from '../types';

type StatusListener = (status: ConnectionStatus) => void;
type VolumeListener = (percent: number) => void;
type FreqRangeListener = (range: BenchFreqRange) => void;
type ErrorListener = (message: string) => void;

export interface WebBleListenerHandle {
  remove: () => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function decodeFreqRange(view: DataView): BenchFreqRange {
  return { lowerHz: view.getUint16(0, true), upperHz: view.getUint16(2, true) };
}

function encodeFreqRange(range: BenchFreqRange): ArrayBuffer {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, Math.round(range.lowerHz), true);
  view.setUint16(2, Math.round(range.upperHz), true);
  return buf;
}

/**
 * Web Bluetooth client for the Haven Audio Control Service ONLY -- the
 * bench-firmware GATT service (haven-zephyr-app's gatt_audio_service.c).
 *
 * This is deliberately NOT a web port of the production JSON/NUS protocol:
 * react-native-ble-plx (which speaks that, in BleConnectionManager.ts) is a
 * native module with no browser equivalent, and the production app's own
 * web build has never supported real BLE for that reason. This class exists
 * only so the bench controls (Volume/FreqRange) work from a desktop browser
 * without a phone or dev-client build, mirroring haven-zephyr-app's
 * tools/ble_bench_test.html but inside the real app's UI.
 */
export class WebBenchBle {
  private status: ConnectionStatus = 'idle';
  private device: BluetoothDevice | null = null;
  private volumeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private freqChar: BluetoothRemoteGATTCharacteristic | null = null;

  private volume: number | null = null;
  private freqRange: BenchFreqRange | null = null;

  private readonly statusListeners = new Set<StatusListener>();
  private readonly volumeListeners = new Set<VolumeListener>();
  private readonly freqRangeListeners = new Set<FreqRangeListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  private readonly onVolumeNotify = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.setVolumeValue(value.getUint8(0));
  };

  private readonly onFreqRangeNotify = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.setFreqRangeValue(decodeFreqRange(value));
  };

  private readonly onGattDisconnected = () => this.handleDisconnect();

  // ── Public API ────────────────────────────────────────────────────────────

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getVolume(): number | null {
    return this.volume;
  }

  getFreqRange(): BenchFreqRange | null {
    return this.freqRange;
  }

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  onStatusChange(listener: StatusListener): WebBleListenerHandle {
    this.statusListeners.add(listener);
    return { remove: () => this.statusListeners.delete(listener) };
  }

  onVolumeChange(listener: VolumeListener): WebBleListenerHandle {
    this.volumeListeners.add(listener);
    return { remove: () => this.volumeListeners.delete(listener) };
  }

  onFreqRangeChange(listener: FreqRangeListener): WebBleListenerHandle {
    this.freqRangeListeners.add(listener);
    return { remove: () => this.freqRangeListeners.delete(listener) };
  }

  onError(listener: ErrorListener): WebBleListenerHandle {
    this.errorListeners.add(listener);
    return { remove: () => this.errorListeners.delete(listener) };
  }

  async connect(): Promise<void> {
    if (this.status !== 'idle' && this.status !== 'disconnected') return;

    if (!this.isSupported()) {
      this.emitError('This browser does not support Web Bluetooth. Use Chrome or Edge.');
      return;
    }

    try {
      this.setStatus('scanning');
      // Filtering by name, not service UUID: the firmware's advertising
      // packet has no room left for a second 128-bit UUID once NUS's own
      // is in there -- see haven-zephyr-app/README.md.
      const device = await navigator.bluetooth!.requestDevice({
        filters: [{ name: DEVICE_NAME }],
        optionalServices: [BENCH_AUDIO_SERVICE_UUID],
      });

      this.setStatus('connecting');
      device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BENCH_AUDIO_SERVICE_UUID);
      const volumeChar = await service.getCharacteristic(BENCH_VOLUME_CHAR_UUID);
      const freqChar = await service.getCharacteristic(BENCH_FREQ_RANGE_CHAR_UUID);

      this.device = device;
      this.volumeChar = volumeChar;
      this.freqChar = freqChar;

      const volumeVal = await volumeChar.readValue();
      this.setVolumeValue(volumeVal.getUint8(0));
      const freqVal = await freqChar.readValue();
      this.setFreqRangeValue(decodeFreqRange(freqVal));

      await volumeChar.startNotifications();
      volumeChar.addEventListener('characteristicvaluechanged', this.onVolumeNotify);
      await freqChar.startNotifications();
      freqChar.addEventListener('characteristicvaluechanged', this.onFreqRangeNotify);

      this.setStatus('connected');
    } catch (err) {
      this.teardown();
      this.setStatus('idle');
      this.emitError(errorMessage(err));
    }
  }

  disconnect(): void {
    this.device?.gatt?.disconnect(); // triggers onGattDisconnected -> handleDisconnect()
  }

  /** Resolves once the board accepts the write; rejects (out-of-range, etc.) otherwise. */
  async setVolume(percent: number): Promise<void> {
    if (!this.volumeChar) throw new Error('Not connected.');
    try {
      await this.volumeChar.writeValueWithResponse(new Uint8Array([Math.round(percent)]));
      this.setVolumeValue(Math.round(percent)); // covers a slow/absent notify echo
    } catch (err) {
      this.emitError(errorMessage(err));
      throw err;
    }
  }

  /** Resolves once the board accepts the write; rejects (out-of-range, etc.) otherwise. */
  async setFreqRange(range: BenchFreqRange): Promise<void> {
    if (!this.freqChar) throw new Error('Not connected.');
    try {
      await this.freqChar.writeValueWithResponse(encodeFreqRange(range));
      this.setFreqRangeValue(range);
    } catch (err) {
      this.emitError(errorMessage(err));
      throw err;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private handleDisconnect(): void {
    this.teardown();
    this.setStatus('disconnected');
  }

  private teardown(): void {
    this.device?.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
    this.volumeChar?.removeEventListener('characteristicvaluechanged', this.onVolumeNotify);
    this.freqChar?.removeEventListener('characteristicvaluechanged', this.onFreqRangeNotify);
    this.device = null;
    this.volumeChar = null;
    this.freqChar = null;
    this.volume = null;
    this.freqRange = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private setVolumeValue(percent: number): void {
    if (this.volume === percent) return;
    this.volume = percent;
    this.volumeListeners.forEach((listener) => listener(percent));
  }

  private setFreqRangeValue(range: BenchFreqRange): void {
    const prev = this.freqRange;
    if (prev && prev.lowerHz === range.lowerHz && prev.upperHz === range.upperHz) return;
    this.freqRange = range;
    this.freqRangeListeners.forEach((listener) => listener(range));
  }

  private emitError(message: string): void {
    this.errorListeners.forEach((listener) => listener(message));
  }
}

let shared: WebBenchBle | null = null;

export function getWebBenchBle(): WebBenchBle {
  if (!shared) shared = new WebBenchBle();
  return shared;
}
