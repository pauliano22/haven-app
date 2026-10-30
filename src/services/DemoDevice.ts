import { ATTEN_MAX_DB, ATTEN_MIN_DB, F0_MAX, F0_MIN, MAX_BANDS, Q_MAX, Q_MIN } from '../constants/dsp';
import { ConnectionStatus, DspPayload } from '../types';

/**
 * Demo mode only (docs/demo-mode.md): a software stand-in for the Haven
 * firmware, so the web build can show every screen without hardware.
 *
 * It speaks the real wire contract — it receives the same DspPayload objects
 * the app would write over NUS RX and emits the same `\n`-terminated JSON
 * lines the firmware formats in src/ack.c (haven-zephyr-app
 * docs/nus-acks.md), so the app parses them with the real
 * parseDeviceLine(). It also enforces the firmware's own safety layer
 * independently of the app's: the 85 dB tone ceiling
 * (PROTOCOL_TONE_LEVEL_MAX_DB) and the 3 s TONE_LEVEL keep-alive watchdog
 * (tone_safety.c). Neither is relaxed for the demo.
 */

/** Firmware's independent tone ceiling (protocol.c PROTOCOL_TONE_LEVEL_MAX_DB). */
export const DEMO_DEVICE_TONE_MAX_DB = 85;
/** Firmware keep-alive window (tone_safety.c): no TONE_LEVEL for this long silences the tone. */
export const DEMO_DEVICE_TONE_WATCHDOG_MS = 3000;

export const DEMO_FIRMWARE_VERSION = '0.1.0-demo';

export interface DemoTone {
  f0: number;
  levelDb: number;
}

type Listener<T> = (value: T) => void;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export class DemoDevice {
  private status: ConnectionStatus = 'idle';
  private tone: DemoTone | null = null;
  private bypass = false;
  private bandCount = 0;
  private battery = 82;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private connectTimers: ReturnType<typeof setTimeout>[] = [];
  private batteryTimer: ReturnType<typeof setInterval> | null = null;

  private lineListeners = new Set<Listener<string>>();
  private statusListeners = new Set<Listener<ConnectionStatus>>();
  private toneListeners = new Set<Listener<DemoTone | null>>();
  private batteryListeners = new Set<Listener<number>>();

  getStatus(): ConnectionStatus {
    return this.status;
  }
  getTone(): DemoTone | null {
    return this.tone;
  }
  getBattery(): number {
    return this.battery;
  }
  isBypassed(): boolean {
    return this.bypass;
  }
  getAppliedBandCount(): number {
    return this.bandCount;
  }

  /** Raw device → app lines, exactly as they'd arrive over NUS TX. */
  onLine(l: Listener<string>) {
    return this.sub(this.lineListeners, l);
  }
  onStatusChange(l: Listener<ConnectionStatus>) {
    return this.sub(this.statusListeners, l);
  }
  /** What the simulated speaker is playing (null = silent). Drives demo audio. */
  onToneChange(l: Listener<DemoTone | null>) {
    return this.sub(this.toneListeners, l);
  }
  onBatteryChange(l: Listener<number>) {
    return this.sub(this.batteryListeners, l);
  }

  /** Scan → connect → boot event, with short delays so the UI shows each state. */
  connect(): void {
    if (this.status === 'connected' || this.status === 'scanning' || this.status === 'connecting') {
      return;
    }
    this.clearConnectTimers();
    this.setStatus('scanning');
    this.connectTimers.push(
      setTimeout(() => this.setStatus('connecting'), 600),
      setTimeout(() => {
        this.setStatus('connected');
        this.emit({
          event: 'boot',
          fw: DEMO_FIRMWARE_VERSION,
          fdsp_rate: 192000,
          dac_source: 'fdsp',
        });
        this.startBattery();
      }, 1200),
    );
  }

  disconnect(): void {
    this.clearConnectTimers();
    this.silence();
    this.stopBattery();
    this.setStatus('disconnected');
  }

  /** One line written by the app. Mirrors protocol.c + tone_safety.c + ack.c. */
  write(payload: DspPayload): void {
    if (this.status !== 'connected') return; // nothing is listening

    switch (payload.type) {
      case 'MULTI_FILTER': {
        const applied = payload.bands.slice(0, MAX_BANDS).map((b) => ({
          f0: clamp(b.f0, F0_MIN, F0_MAX),
          Q: clamp(b.Q, Q_MIN, Q_MAX),
          atten_db: clamp(b.atten_db, ATTEN_MIN_DB, ATTEN_MAX_DB),
        }));
        this.bandCount = applied.length;
        this.emit({ ack: 'MULTI_FILTER', ok: true, bands: applied.length });
        return;
      }
      case 'BYPASS':
        this.bypass = payload.enabled;
        this.emit({ ack: 'BYPASS', ok: true, enabled: payload.enabled });
        return;
      case 'TONE_START': {
        const f0 = Math.round(clamp(payload.f0, F0_MIN, F0_MAX));
        const levelDb = Math.round(this.clampTone(payload.level_db));
        this.setTone({ f0, levelDb });
        this.armWatchdog();
        this.emit({ ack: 'TONE_START', ok: true, f0, level_db: levelDb });
        return;
      }
      case 'TONE_LEVEL': {
        const levelDb = Math.round(this.clampTone(payload.level_db));
        if (this.tone) {
          this.setTone({ f0: this.tone.f0, levelDb });
          this.armWatchdog();
        }
        this.emit({ ack: 'TONE_LEVEL', ok: true, level_db: levelDb });
        return;
      }
      case 'TONE_STOP':
        this.silence();
        this.emit({ ack: 'TONE_STOP', ok: true });
        return;
      default:
        this.emit({ ack: '?', ok: false, err: 'parse' });
    }
  }

  /** Stop all timers (tests, unmount). */
  dispose(): void {
    this.clearConnectTimers();
    this.clearWatchdog();
    this.stopBattery();
  }

  private clampTone(levelDb: number): number {
    if (!Number.isFinite(levelDb)) return 0;
    return clamp(levelDb, 0, DEMO_DEVICE_TONE_MAX_DB);
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (!this.tone) return;
      // Silence first; the event is informational and sent after (nus-acks.md).
      this.setTone(null);
      this.emit({ event: 'tone_watchdog' });
    }, DEMO_DEVICE_TONE_WATCHDOG_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private silence(): void {
    this.clearWatchdog();
    this.setTone(null);
  }

  private setTone(tone: DemoTone | null): void {
    this.tone = tone;
    this.toneListeners.forEach((l) => l(tone));
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private startBattery(): void {
    this.stopBattery();
    // Drift down 1% a minute while connected, floor at 20% so the demo never "dies".
    this.batteryTimer = setInterval(() => {
      this.battery = Math.max(20, this.battery - 1);
      this.batteryListeners.forEach((l) => l(this.battery));
    }, 60000);
  }

  private stopBattery(): void {
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    this.batteryTimer = null;
  }

  private clearConnectTimers(): void {
    this.connectTimers.forEach(clearTimeout);
    this.connectTimers = [];
  }

  private emit(message: Record<string, unknown>): void {
    const line = JSON.stringify(message) + '\n';
    this.lineListeners.forEach((l) => l(line));
  }

  private sub<T>(set: Set<Listener<T>>, l: Listener<T>) {
    set.add(l);
    return { remove: () => set.delete(l) };
  }
}

let instance: DemoDevice | null = null;

export function getDemoDevice(): DemoDevice {
  if (!instance) instance = new DemoDevice();
  return instance;
}
