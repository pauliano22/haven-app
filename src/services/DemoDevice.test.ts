import { parseDeviceLine } from '../utils/deviceMessages';
import { DEMO_AUDIO_MAX_GAIN, demoGainForLevel } from './demoAudio';
import {
  DEMO_DEVICE_TONE_MAX_DB,
  DEMO_DEVICE_TONE_WATCHDOG_MS,
  DemoDevice,
  DemoTone,
} from './DemoDevice';

function connected() {
  const device = new DemoDevice();
  const lines: string[] = [];
  const tones: (DemoTone | null)[] = [];
  device.onLine((l) => lines.push(l));
  device.onToneChange((t) => tones.push(t));
  device.connect();
  jest.advanceTimersByTime(1500);
  const messages = () => lines.map((l) => parseDeviceLine(l.trim()));
  return { device, lines, tones, messages };
}

describe('DemoDevice', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('connects and announces a limiter-safe boot event in the firmware wire format', () => {
    const { device, messages } = connected();
    expect(device.getStatus()).toBe('connected');
    expect(messages()[0]).toEqual({
      kind: 'event',
      event: 'boot',
      fw: '0.1.0-demo',
      fdspRate: 192000,
      dacSource: 'fdsp',
    });
    device.dispose();
  });

  it('clamps a tone above the ceiling to 85 dB and acks the applied value', () => {
    const { device, messages } = connected();
    device.write({ type: 'TONE_START', f0: 4000, level_db: 120 });
    expect(device.getTone()).toEqual({ f0: 4000, levelDb: DEMO_DEVICE_TONE_MAX_DB });
    expect(messages().at(-1)).toEqual({ kind: 'ack', cmd: 'TONE_START', ok: true, f0: 4000, levelDb: 85 });
    device.write({ type: 'TONE_LEVEL', level_db: 999 });
    expect(device.getTone()?.levelDb).toBe(85);
    expect(messages().at(-1)).toEqual({ kind: 'ack', cmd: 'TONE_LEVEL', ok: true, levelDb: 85 });
    device.dispose();
  });

  it('treats a non-finite level as silence-level, never as loud', () => {
    const { device } = connected();
    device.write({ type: 'TONE_START', f0: 1000, level_db: Number.NaN });
    expect(device.getTone()?.levelDb).toBe(0);
    device.dispose();
  });

  it('silences the tone and then sends tone_watchdog when keep-alives stop', () => {
    const { device, tones, messages } = connected();
    device.write({ type: 'TONE_START', f0: 2000, level_db: 40 });
    jest.advanceTimersByTime(DEMO_DEVICE_TONE_WATCHDOG_MS - 1);
    expect(device.getTone()).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(device.getTone()).toBeNull();
    expect(tones.at(-1)).toBeNull();
    expect(messages().at(-1)).toEqual({ kind: 'event', event: 'tone_watchdog' });
    device.dispose();
  });

  it('keeps the tone alive while TONE_LEVEL keeps arriving', () => {
    const { device } = connected();
    device.write({ type: 'TONE_START', f0: 2000, level_db: 40 });
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(700);
      device.write({ type: 'TONE_LEVEL', level_db: 40 + 2 * i });
    }
    expect(device.getTone()).toEqual({ f0: 2000, levelDb: 58 });
    jest.advanceTimersByTime(DEMO_DEVICE_TONE_WATCHDOG_MS);
    expect(device.getTone()).toBeNull();
    device.dispose();
  });

  it('stops on TONE_STOP and on disconnect, with no late watchdog event', () => {
    const { device, messages } = connected();
    device.write({ type: 'TONE_START', f0: 2000, level_db: 40 });
    device.write({ type: 'TONE_STOP' });
    expect(device.getTone()).toBeNull();
    device.write({ type: 'TONE_START', f0: 2000, level_db: 40 });
    device.disconnect();
    expect(device.getTone()).toBeNull();
    const before = messages().length;
    jest.advanceTimersByTime(DEMO_DEVICE_TONE_WATCHDOG_MS * 2);
    expect(messages().length).toBe(before);
    device.dispose();
  });

  it('caps filters at 5 bands and acks the applied count', () => {
    const { device, messages } = connected();
    const band = { f0: 4000, Q: 10, atten_db: 20 };
    device.write({ type: 'MULTI_FILTER', bands: Array(7).fill(band) });
    expect(device.getAppliedBandCount()).toBe(5);
    expect(messages().at(-1)).toEqual({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 5 });
    device.dispose();
  });

  it('ignores writes while disconnected', () => {
    const device = new DemoDevice();
    const lines: string[] = [];
    device.onLine((l) => lines.push(l));
    device.write({ type: 'TONE_START', f0: 1000, level_db: 50 });
    expect(device.getTone()).toBeNull();
    expect(lines).toHaveLength(0);
  });
});

describe('demoGainForLevel', () => {
  it('never exceeds -30 dBFS, even above the ceiling', () => {
    expect(demoGainForLevel(85)).toBeCloseTo(DEMO_AUDIO_MAX_GAIN);
    expect(demoGainForLevel(200)).toBeCloseTo(DEMO_AUDIO_MAX_GAIN);
    expect(demoGainForLevel(Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(DEMO_AUDIO_MAX_GAIN);
  });

  it('gets quieter as the level drops', () => {
    expect(demoGainForLevel(65)).toBeCloseTo(DEMO_AUDIO_MAX_GAIN / 10);
    expect(demoGainForLevel(30)).toBeLessThan(demoGainForLevel(31));
    expect(demoGainForLevel(-10)).toBe(demoGainForLevel(0));
  });
});
