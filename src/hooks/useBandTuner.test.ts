import { act, renderHook } from '@testing-library/react-native';
import { ATTEN_MAX_DB, ATTEN_MIN_DB, Q_MAX, Q_MIN } from '../constants/dsp';
import { useBandTuner } from './useBandTuner';

const BAND_ID = 'b1';
let mockBands = [{ id: BAND_ID, f0: 4500, q: 10, attenDb: 20 }];
const mockUpdateBand = jest.fn((id: string, patch: Partial<{ f0: number; q: number; attenDb: number }>) => {
  mockBands = mockBands.map((b) => (b.id === id ? { ...b, ...patch } : b));
});

jest.mock('../context/FilterContext', () => ({
  useFilters: () => ({ bands: mockBands, updateBand: mockUpdateBand }),
}));

/** Answers every comparison by preferring whichever candidate is closer to
 * a fixed target, mirroring preferenceSearch.test.ts's approach -- lets us
 * assert the hook actually converges, not just that it doesn't crash. */
function answerTowards(target: number, pair: { a: number; b: number } | null): 'a' | 'b' | 'same' {
  if (!pair) throw new Error('expected an active pair');
  const da = Math.abs(pair.a - target);
  const db = Math.abs(pair.b - target);
  if (da === db) return 'same';
  return da < db ? 'a' : 'b';
}

describe('useBandTuner', () => {
  beforeEach(() => {
    mockBands = [{ id: BAND_ID, f0: 4500, q: 10, attenDb: 20 }];
    mockUpdateBand.mockClear();
  });

  it('is inactive until start() is called', () => {
    const { result } = renderHook(() => useBandTuner(BAND_ID));
    expect(result.current.active).toBe(false);
    expect(result.current.pair).toBeNull();
  });

  it('starts the depth phase and immediately applies the first candidate live', () => {
    const { result } = renderHook(() => useBandTuner(BAND_ID));
    act(() => result.current.start());

    expect(result.current.active).toBe(true);
    expect(result.current.phase).toBe('depth');
    expect(result.current.pair).not.toBeNull();
    // Something within the real range was pushed to the device already.
    expect(mockUpdateBand).toHaveBeenCalledWith(BAND_ID, expect.objectContaining({ attenDb: expect.any(Number) }));
    expect(mockBands[0].attenDb).toBeGreaterThanOrEqual(ATTEN_MIN_DB);
    expect(mockBands[0].attenDb).toBeLessThanOrEqual(ATTEN_MAX_DB);
  });

  it('playOption switches the live value without advancing the search', () => {
    const { result } = renderHook(() => useBandTuner(BAND_ID));
    act(() => result.current.start());
    const pair = result.current.pair!;
    const countBefore = result.current.comparisonCount;

    act(() => result.current.playOption('b'));

    expect(mockBands[0].attenDb).toBe(pair.b);
    expect(result.current.activeChoice).toBe('b');
    expect(result.current.comparisonCount).toBe(countBefore);
  });

  it('runs depth to completion, then width, then finishes with both values in range', () => {
    const { result } = renderHook(() => useBandTuner(BAND_ID));
    act(() => result.current.start());

    // Drive the depth phase toward a target, same convergence property
    // preferenceSearch.test.ts verifies on the algorithm directly.
    const depthTarget = 9;
    let guard = 0;
    while (result.current.phase === 'depth') {
      const pick = answerTowards(depthTarget, result.current.pair);
      act(() => result.current.choose(pick));
      if (++guard > 20) throw new Error('depth phase did not converge');
    }

    expect(mockBands[0].attenDb).toBeGreaterThanOrEqual(ATTEN_MIN_DB);
    expect(mockBands[0].attenDb).toBeLessThanOrEqual(ATTEN_MAX_DB);
    expect(result.current.phase).toBe('width');
    expect(result.current.pair).not.toBeNull();

    const widthTarget = 14;
    guard = 0;
    while (result.current.phase === 'width') {
      const pick = answerTowards(widthTarget, result.current.pair);
      act(() => result.current.choose(pick));
      if (++guard > 20) throw new Error('width phase did not converge');
    }

    expect(result.current.phase).toBe('done');
    expect(result.current.active).toBe(false);
    expect(result.current.pair).toBeNull();
    expect(mockBands[0].q).toBeGreaterThanOrEqual(Q_MIN);
    expect(mockBands[0].q).toBeLessThanOrEqual(Q_MAX);
    // f0 is never touched by this search.
    expect(mockBands[0].f0).toBe(4500);
  });

  it('cancel() restores the pre-search attenDb and q, and clears active state', () => {
    const { result } = renderHook(() => useBandTuner(BAND_ID));
    act(() => result.current.start());
    act(() => result.current.choose('a'));
    expect(mockBands[0].attenDb).not.toBe(20); // moved away from the original

    act(() => result.current.cancel());

    expect(mockBands[0].attenDb).toBe(20);
    expect(mockBands[0].q).toBe(10);
    expect(result.current.active).toBe(false);
    expect(result.current.pair).toBeNull();
  });
});
