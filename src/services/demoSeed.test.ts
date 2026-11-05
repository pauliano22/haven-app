import { ATTEN_MAX_DB, ATTEN_MIN_DB, F0_MAX, F0_MIN, MAX_BANDS, Q_MAX, Q_MIN } from '../constants/dsp';
import { MAX_TONE_LEVEL_DB } from '../constants/safety';
import { assignmentFor } from '../utils/nof1';
import { scoreThi } from '../utils/thi';
import { buildDemoData } from './demoSeed';

describe('demo example data', () => {
  const now = new Date(2026, 9, 29, 14, 0).getTime();
  const d = buildDemoData(now);

  it('uses only band values the app itself allows', () => {
    expect(d.filterProfile.bands.length).toBeLessThanOrEqual(MAX_BANDS);
    for (const b of d.filterProfile.bands) {
      expect(b.f0).toBeGreaterThanOrEqual(F0_MIN);
      expect(b.f0).toBeLessThanOrEqual(F0_MAX);
      expect(b.q).toBeGreaterThanOrEqual(Q_MIN);
      expect(b.q).toBeLessThanOrEqual(Q_MAX);
      expect(b.attenDb).toBeGreaterThanOrEqual(ATTEN_MIN_DB);
      expect(b.attenDb).toBeLessThanOrEqual(ATTEN_MAX_DB);
    }
  });

  it('never records a comfort level above the tone ceiling', () => {
    for (const run of d.ldl) {
      for (const r of run.results) {
        if (r.ldlDb !== null) expect(r.ldlDb).toBeLessThanOrEqual(MAX_TONE_LEVEL_DB);
      }
    }
  });

  it('stores THI totals that match their answers', () => {
    for (const t of d.thi) expect(t.total).toBe(scoreThi(t.answers));
  });

  it('puts today on a protection-on trial day, so the demo opens protected', () => {
    expect(assignmentFor(d.trial, now)).toBe('active');
  });
});
