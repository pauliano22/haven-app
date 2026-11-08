import {
  DIARY_BAND_COUNT,
  DIARY_FLOOR_DB,
  averageFrames,
  bandLevelsFromSpectrum,
  powerToDb,
} from './soundFeatures';

describe('powerToDb', () => {
  it('maps full scale to 0 dB and floors silence', () => {
    expect(powerToDb(1)).toBeCloseTo(0);
    expect(powerToDb(0.01)).toBeCloseTo(-20);
    expect(powerToDb(0)).toBe(DIARY_FLOOR_DB);
    expect(powerToDb(-1)).toBe(DIARY_FLOOR_DB);
  });
});

describe('bandLevelsFromSpectrum', () => {
  const SR = 48000;
  const BINS = 1024; // 23.4 Hz per bin
  const spectrum = (hz: number, mag: number) => {
    const m = new Float32Array(BINS);
    m[Math.round(hz / (SR / 2 / BINS))] = mag;
    return m;
  };

  it('puts a 1 kHz tone in the 710-1400 Hz band and nowhere else', () => {
    const frame = bandLevelsFromSpectrum(spectrum(1000, 0.5), SR, 1000);
    expect(frame.bands).toHaveLength(DIARY_BAND_COUNT);
    const loudest = frame.bands.indexOf(Math.max(...frame.bands));
    expect(loudest).toBe(3);
    frame.bands.forEach((db, b) => {
      if (b !== 3) expect(db).toBe(DIARY_FLOOR_DB);
    });
    expect(frame.timestamp).toBe(1000);
  });

  it('reads silence as the floor in every band', () => {
    const frame = bandLevelsFromSpectrum(new Float32Array(BINS), SR, 5);
    expect(frame.overallDb).toBe(DIARY_FLOOR_DB);
    expect(frame.bands.every((b) => b === DIARY_FLOOR_DB)).toBe(true);
  });

  it('reads a louder tone as a higher level', () => {
    const quiet = bandLevelsFromSpectrum(spectrum(3000, 0.01), SR, 0);
    const loud = bandLevelsFromSpectrum(spectrum(3000, 0.1), SR, 0);
    expect(loud.bands[5] - quiet.bands[5]).toBeCloseTo(20, 0);
  });
});

describe('averageFrames', () => {
  it('returns null for no frames', () => {
    expect(averageFrames([])).toBeNull();
  });

  it('averages in power so one loud frame is not washed out', () => {
    const quiet = { timestamp: 0, bands: new Array(DIARY_BAND_COUNT).fill(-60), overallDb: -60 };
    const loud = { timestamp: 1, bands: new Array(DIARY_BAND_COUNT).fill(-20), overallDb: -20 };
    const avg = averageFrames([quiet, loud])!;
    // Power average of -60 and -20 dB is about -23 dB, not the dB mean of -40.
    expect(avg.overallDb).toBeGreaterThan(-24);
    expect(avg.overallDb).toBeLessThan(-22);
  });
});
