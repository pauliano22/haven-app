import { DEMO_DEVICE_TONE_MAX_DB, DemoTone } from './DemoDevice';

/**
 * Demo mode only: plays the simulated device's tone through the browser so
 * the hearing tests can be heard. The dB values on the wire are nominal
 * device levels, not calibrated SPL, so this maps them onto a deliberately
 * quiet range: the 85 dB ceiling plays at -30 dBFS and everything scales
 * down from there. Browsers only allow audio after a user gesture, and
 * every tone here starts from a tap.
 */

/** Gain at the device ceiling: -30 dBFS. */
export const DEMO_AUDIO_MAX_GAIN = 0.0316;

export function demoGainForLevel(levelDb: number): number {
  if (Number.isNaN(levelDb)) return 0;
  const db = Math.min(DEMO_DEVICE_TONE_MAX_DB, Math.max(0, levelDb));
  return DEMO_AUDIO_MAX_GAIN * Math.pow(10, (db - DEMO_DEVICE_TONE_MAX_DB) / 20);
}

type AudioCtor = typeof AudioContext;

export class DemoAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.play(null);
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(tone: DemoTone | null): void {
    if (tone === null || this.muted) {
      this.stop();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const target = demoGainForLevel(tone.levelDb);
    if (!this.osc || !this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(ctx.destination);
      this.osc = ctx.createOscillator();
      this.osc.type = 'sine';
      this.osc.connect(this.gain);
      this.osc.start();
    }
    this.osc.frequency.setTargetAtTime(tone.f0, ctx.currentTime, 0.01);
    this.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
  }

  private stop(): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const osc = this.osc;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    osc.stop(this.ctx.currentTime + 0.15);
    this.osc = null;
    this.gain = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }
}
