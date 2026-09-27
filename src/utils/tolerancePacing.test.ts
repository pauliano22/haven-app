import { computeNextIntervalMs, MAX_INTERVAL_MS, MIN_INTERVAL_MS } from './tolerancePacing';

const BASE = 7 * 24 * 60 * 60 * 1000; // 1 week, matches TOLERANCE_STEP_INTERVAL_MS

describe('computeNextIntervalMs', () => {
  it('leaves the interval unchanged with fewer than 2 recent responses', () => {
    expect(computeNextIntervalMs(BASE, [])).toBe(BASE);
    expect(computeNextIntervalMs(BASE, ['weaker'])).toBe(BASE);
  });

  it('doubles the interval when the last two responses were both "too strong"', () => {
    expect(computeNextIntervalMs(BASE, ['same', 'weaker', 'weaker'])).toBe(BASE * 2);
  });

  it('halves the interval when the last two responses were comfortable or wanting less softening', () => {
    expect(computeNextIntervalMs(BASE, ['weaker', 'same', 'same'])).toBe(BASE / 2);
    expect(computeNextIntervalMs(BASE, ['stronger', 'stronger'])).toBe(BASE / 2);
    expect(computeNextIntervalMs(BASE, ['same', 'stronger'])).toBe(BASE / 2); // mixed within the "comfortable or less" set is still consistent
  });

  it('leaves the interval unchanged on a genuinely mixed last two responses', () => {
    expect(computeNextIntervalMs(BASE, ['weaker', 'same', 'weaker', 'stronger'])).toBe(BASE);
  });

  it('only ever looks at the last two responses, not the whole history', () => {
    // Lots of 'weaker' in the past, but the two most recent are comfortable --
    // should speed up, not be dragged down by older signal.
    const history = ['weaker', 'weaker', 'weaker', 'same', 'same'] as const;
    expect(computeNextIntervalMs(BASE, history)).toBe(BASE / 2);
  });

  it('never doubles past the ceiling', () => {
    const nearCeiling = MAX_INTERVAL_MS - 1000;
    expect(computeNextIntervalMs(nearCeiling, ['weaker', 'weaker'])).toBe(MAX_INTERVAL_MS);
  });

  it('never halves below the floor', () => {
    const nearFloor = MIN_INTERVAL_MS + 1000;
    expect(computeNextIntervalMs(nearFloor, ['same', 'same'])).toBe(MIN_INTERVAL_MS);
  });
});
