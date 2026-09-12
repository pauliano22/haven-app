import { LDL_DRIFT_WARN_DB, MAX_TONE_LEVEL_DB } from '../constants/safety';
import { FilterBand, LdlRun } from '../types';
import { findLdlDrift, nearestTestFrequency } from './ldlDrift';

const FREQS = [1000, 2000, 3000, 4000, 6000, 8000];
const run = (timestamp: number, ldls: Array<number | null>): LdlRun => ({
  timestamp,
  results: ldls.map((ldlDb, i) => ({ f0: FREQS[i], ldlDb })),
});
const band = (id: string, f0: number, attenDb = 20): FilterBand => ({ id, f0, q: 10, attenDb });

describe('nearestTestFrequency', () => {
  it('maps a band to the nearest test tone when within a third of an octave', () => {
    expect(nearestTestFrequency(4000)).toBe(4000);
    expect(nearestTestFrequency(4500)).toBe(4000);
    expect(nearestTestFrequency(2600)).toBe(3000);
  });

  it('returns null for bands far from every test tone', () => {
    expect(nearestTestFrequency(300)).toBeNull(); // > 1/3 octave below 1 kHz
    expect(nearestTestFrequency(500)).toBeNull();
    expect(nearestTestFrequency(0)).toBeNull();
  });

  it('accepts exactly a third of an octave and rejects just beyond it', () => {
    const third = 2 ** (1 / 3);
    expect(nearestTestFrequency(8000 * third * 0.999)).toBe(8000);
    expect(nearestTestFrequency(8000 * third * 1.01)).toBeNull();
  });
});

describe('findLdlDrift', () => {
  it('needs at least two runs', () => {
    expect(findLdlDrift([run(1, [60, null, null, null, null, null])], [band('b', 1000)])).toEqual([]);
  });

  it('warns when the LDL at a softened frequency has dropped by the threshold', () => {
    const history = [run(2, [null, null, null, 55, null, null]), run(1, [null, null, null, 70, null, null])];
    const warnings = findLdlDrift(history, [band('b', 4200)]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      bandId: 'b',
      f0: 4200,
      testFreqHz: 4000,
      baselineLdlDb: 70,
      latestLdlDb: 55,
      dropDb: 15,
    });
  });

  it('does not warn for a drop smaller than the threshold', () => {
    const history = [
      run(2, [null, null, null, 70 - LDL_DRIFT_WARN_DB + 1, null, null]),
      run(1, [null, null, null, 70, null, null]),
    ];
    expect(findLdlDrift(history, [band('b', 4000)])).toEqual([]);
  });

  it('treats a baseline that was comfortable to the ceiling as the ceiling', () => {
    const history = [run(2, [60, null, null, null, null, null]), run(1, [null, null, null, null, null, null])];
    const [w] = findLdlDrift(history, [band('b', 1000)]);
    expect(w.baselineLdlDb).toBe(MAX_TONE_LEVEL_DB);
    expect(w.dropDb).toBe(MAX_TONE_LEVEL_DB - 60);
  });

  it('does not warn when the latest run was comfortable to the ceiling (a recovery, not a drop)', () => {
    const history = [run(2, [null, null, null, null, null, null]), run(1, [60, null, null, null, null, null])];
    expect(findLdlDrift(history, [band('b', 1000)])).toEqual([]);
  });

  it('uses the oldest run as baseline and the newest measured run as latest, regardless of order given', () => {
    const oldestFirst = [
      run(1, [80, null, null, null, null, null]),
      run(2, [75, null, null, null, null, null]),
      run(3, [62, null, null, null, null, null]),
    ];
    const [w] = findLdlDrift(oldestFirst, [band('b', 1000)]);
    expect(w).toMatchObject({ baselineLdlDb: 80, latestLdlDb: 62, dropDb: 18 });
    const [w2] = findLdlDrift([...oldestFirst].reverse(), [band('b', 1000)]);
    expect(w2).toEqual(w);
  });

  it('skips bands with no softening and bands far from every test tone', () => {
    const history = [run(2, [50, 50, 50, 50, 50, 50]), run(1, [80, 80, 80, 80, 80, 80])];
    const warnings = findLdlDrift(history, [band('paused', 1000, 0), band('far', 300), band('live', 2000)]);
    expect(warnings.map((w) => w.bandId)).toEqual(['live']);
  });

  it('ignores a frequency that was skipped in the baseline run', () => {
    const history = [
      run(2, [55, null, null, null, null, null]),
      { timestamp: 1, results: [{ f0: 2000, ldlDb: 80 }] }, // 1 kHz never tested at baseline
    ];
    expect(findLdlDrift(history, [band('b', 1000)])).toEqual([]);
  });
});
