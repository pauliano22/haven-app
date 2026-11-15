import { DiaryFrame } from '../utils/soundFeatures';
import { SoundCaptureHandle } from './soundCaptureTypes';

export type { SoundCaptureHandle };

/**
 * Microphone listening for the sound diary. This file is the fallback used
 * where no implementation exists (the phone builds): listening is not
 * available there yet because band levels from the microphone need a native
 * audio module, which comes with the dev-client build (docs/dev-client-build.md).
 * The browser version is SoundCapture.web.ts.
 */
export const SOUND_CAPTURE_SUPPORTED = false;

export async function startSoundCapture(_onFrame: (frame: DiaryFrame) => void): Promise<SoundCaptureHandle> {
  throw new Error('Listening is not available on this build yet.');
}
