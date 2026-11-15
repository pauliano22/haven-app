import { averageFrames, bandLevelsFromSpectrum, DiaryFrame } from '../utils/soundFeatures';
import { SoundCaptureHandle } from './soundCaptureTypes';

export type { SoundCaptureHandle };
export const SOUND_CAPTURE_SUPPORTED =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Read the spectrum once a second, emit one averaged frame every 5 s. */
const READ_EVERY_MS = 1000;
const FRAME_EVERY_READS = 5;

/**
 * Browser listening. Only band levels leave this function; the raw audio is
 * analysed by the AnalyserNode and never recorded, stored or sent anywhere.
 * The browser shows its own microphone indicator while this is running.
 */
export async function startSoundCapture(onFrame: (frame: DiaryFrame) => void): Promise<SoundCaptureHandle> {
  if (!SOUND_CAPTURE_SUPPORTED) throw new Error('This browser cannot listen to the microphone.');
  const stream = await navigator.mediaDevices.getUserMedia({
    // Raw sound, so the app sees what the ear would hear.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const AudioCtx: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const dbBins = new Float32Array(analyser.frequencyBinCount);
  const mags = new Float32Array(analyser.frequencyBinCount);
  let pending: DiaryFrame[] = [];

  const timer = setInterval(() => {
    analyser.getFloatFrequencyData(dbBins);
    for (let i = 0; i < dbBins.length; i++) {
      mags[i] = Number.isFinite(dbBins[i]) ? 10 ** (dbBins[i] / 20) : 0;
    }
    pending.push(bandLevelsFromSpectrum(mags, ctx.sampleRate, Date.now()));
    if (pending.length >= FRAME_EVERY_READS) {
      const avg = averageFrames(pending);
      pending = [];
      if (avg) onFrame(avg);
    }
  }, READ_EVERY_MS);

  return {
    stop: () => {
      clearInterval(timer);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
