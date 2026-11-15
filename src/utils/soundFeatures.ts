/**
 * Sound features for the trigger diary: how loud the room is in each
 * frequency band. Only these numbers are ever stored, never audio.
 *
 * Levels are RELATIVE (dB below the microphone's full scale, so 0 is the
 * loudest the mic can represent and normal rooms are negative). A phone
 * microphone is not calibrated, so these are not dB SPL and must never be
 * compared with the 85 dB ceiling in constants/safety.ts. They are only
 * useful for comparing one moment with another on the same phone.
 */

/** Octave-wide band edges in Hz. Seven bands from low rumble to hiss. */
export const DIARY_BAND_EDGES_HZ = [90, 180, 355, 710, 1400, 2800, 5600, 11200] as const;
export const DIARY_BAND_COUNT = DIARY_BAND_EDGES_HZ.length - 1;

/** Quietest level reported, so silence does not become -Infinity. */
export const DIARY_FLOOR_DB = -100;

export interface DiaryFrame {
  /** Milliseconds since the epoch. */
  timestamp: number;
  /** Level per band, dB relative to full scale. Length DIARY_BAND_COUNT. */
  bands: number[];
  /** Level of the whole signal in the same units. */
  overallDb: number;
}

export function powerToDb(power: number): number {
  if (!(power > 0)) return DIARY_FLOOR_DB;
  return Math.max(DIARY_FLOOR_DB, 10 * Math.log10(power));
}

/**
 * Turn one FFT magnitude spectrum into band levels.
 *
 * `magnitudes` is linear magnitude per FFT bin (0 .. fftSize/2 - 1), scaled
 * so a full-scale sine reads 1. The caller (a Web Audio AnalyserNode in
 * practice) is responsible for that scaling.
 */
export function bandLevelsFromSpectrum(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  timestamp: number,
): DiaryFrame {
  const bins = magnitudes.length;
  const binHz = sampleRate / 2 / bins;
  const bandPower = new Array<number>(DIARY_BAND_COUNT).fill(0);
  const bandBins = new Array<number>(DIARY_BAND_COUNT).fill(0);
  let totalPower = 0;
  for (let i = 1; i < bins; i++) {
    const hz = i * binHz;
    const power = magnitudes[i] * magnitudes[i];
    totalPower += power;
    for (let b = 0; b < DIARY_BAND_COUNT; b++) {
      if (hz >= DIARY_BAND_EDGES_HZ[b] && hz < DIARY_BAND_EDGES_HZ[b + 1]) {
        bandPower[b] += power;
        bandBins[b] += 1;
        break;
      }
    }
  }
  return {
    timestamp,
    // Mean power per bin keeps wide high bands from looking louder than
    // narrow low ones just because they contain more bins.
    bands: bandPower.map((p, b) => powerToDb(bandBins[b] > 0 ? p / bandBins[b] : 0)),
    overallDb: powerToDb(totalPower / Math.max(1, bins - 1)),
  };
}

/** Average several frames into one, to keep storage small. */
export function averageFrames(frames: DiaryFrame[]): DiaryFrame | null {
  if (frames.length === 0) return null;
  const n = frames.length;
  const bands = new Array<number>(DIARY_BAND_COUNT).fill(0);
  let overall = 0;
  for (const f of frames) {
    // Average in power, not in dB, so one loud moment is not hidden.
    for (let b = 0; b < DIARY_BAND_COUNT; b++) bands[b] += 10 ** (f.bands[b] / 10);
    overall += 10 ** (f.overallDb / 10);
  }
  return {
    timestamp: frames[Math.floor(n / 2)].timestamp,
    bands: bands.map((p) => powerToDb(p / n)),
    overallDb: powerToDb(overall / n),
  };
}
