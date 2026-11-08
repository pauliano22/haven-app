import { DIARY_BAND_COUNT, DiaryFrame } from './soundFeatures';
import {
  DiaryMark,
  MIN_MARKS_EACH,
  analyzeTriggers,
  auc,
  featuresForMark,
} from './triggerAnalysis';

const frame = (timestamp: number, overallDb: number, bandOverrides: Record<number, number> = {}): DiaryFrame => ({
  timestamp,
  overallDb,
  bands: Array.from({ length: DIARY_BAND_COUNT }, (_, b) => bandOverrides[b] ?? -70),
});

describe('auc', () => {
  it('is 1 when every hurt value is higher, 0 when lower, 0.5 for ties', () => {
    expect(auc([5, 6], [1, 2])).toBe(1);
    expect(auc([1, 2], [5, 6])).toBe(0);
    expect(auc([3, 3], [3, 3])).toBe(0.5);
  });
});

describe('featuresForMark', () => {
  it('returns null when nothing was logged in the 30 s before the tap', () => {
    expect(featuresForMark({ timestamp: 100_000, kind: 'hurt' }, [frame(10_000, -40)])).toBeNull();
  });

  it('measures the sudden rise as the steepest dB-per-second step', () => {
    const frames = [frame(70_000, -60), frame(75_000, -60), frame(80_000, -40)];
    const f = featuresForMark({ timestamp: 80_000, kind: 'hurt' }, frames)!;
    expect(f.values.sudden_rise).toBeCloseTo(4); // 20 dB over 5 s
    expect(f.values.level_peak).toBe(-40);
  });

  it('ignores frames after the tap', () => {
    const frames = [frame(70_000, -60), frame(90_000, 0)];
    const f = featuresForMark({ timestamp: 80_000, kind: 'fine' }, frames)!;
    expect(f.values.level_peak).toBe(-60);
  });
});

describe('analyzeTriggers', () => {
  // A synthetic day: every 5 s a frame. The 2.8-5.6 kHz band (index 5) is
  // loud before every "hurt" tap and quiet before every "fine" tap. Overall
  // loudness is deliberately the SAME in both, so only the band should stand out.
  function buildDay(n: number) {
    const frames: DiaryFrame[] = [];
    const marks: DiaryMark[] = [];
    for (let i = 0; i < n * 2; i++) {
      const base = i * 120_000;
      const hurt = i % 2 === 0;
      for (let k = 0; k < 6; k++) {
        frames.push(frame(base + k * 5_000, -30 + (i % 3), { 5: hurt ? -25 : -55 }));
      }
      marks.push({ timestamp: base + 30_000, kind: hurt ? 'hurt' : 'fine' });
    }
    return { frames, marks };
  }

  it('refuses to answer without enough taps of each kind', () => {
    const { frames, marks } = buildDay(MIN_MARKS_EACH - 1);
    const out = analyzeTriggers(marks, frames);
    expect(out.status).toBe('not_enough_data');
    if (out.status === 'not_enough_data') {
      expect(out.hurtMarks).toBe(MIN_MARKS_EACH - 1);
      expect(out.needEach).toBe(MIN_MARKS_EACH);
    }
  });

  it('finds the band that predicts the taps and does not blame overall loudness', () => {
    const { frames, marks } = buildDay(8);
    const out = analyzeTriggers(marks, frames);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.results[0].id).toBe('band_5');
    expect(out.results[0].auc).toBe(1);
    expect(out.results[0].suggestive).toBe(true);
    const level = out.results.find((r) => r.id === 'level_now')!;
    expect(level.suggestive).toBe(false);
  });

  it('does not invent a link when hurt and fine moments look the same', () => {
    const frames: DiaryFrame[] = [];
    const marks: DiaryMark[] = [];
    for (let i = 0; i < 16; i++) {
      const base = i * 120_000;
      frames.push(frame(base, -40), frame(base + 10_000, -40));
      marks.push({ timestamp: base + 20_000, kind: i % 2 ? 'hurt' : 'fine' });
    }
    const out = analyzeTriggers(marks, frames);
    expect(out.status).toBe('ok');
    if (out.status === 'ok') expect(out.results.every((r) => !r.suggestive)).toBe(true);
  });

  it('skips taps that have no sound logged before them', () => {
    const { frames, marks } = buildDay(8);
    const extra: DiaryMark[] = [{ timestamp: 99_999_999_999, kind: 'hurt' }];
    const out = analyzeTriggers([...marks, ...extra], frames);
    expect(out.status === 'ok' && out.hurtMarks).toBe(8);
  });
});
