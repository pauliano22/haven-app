import {
  ComparisonPair,
  choose,
  createSearch,
  currentPair,
  isDone,
  PreferenceChoice,
  result,
  SearchState,
} from './preferenceSearch';

/** Closest candidate to `target` in a pair; 'same' on an exact tie. */
function preferCloserTo(target: number, pair: ComparisonPair): PreferenceChoice {
  const da = Math.abs(pair.a - target);
  const db = Math.abs(pair.b - target);
  if (da === db) return 'same';
  return da < db ? 'a' : 'b';
}

/** Runs a search to completion against a fixed target, with a hard step
 * cap so a regression that breaks termination fails the test instead of
 * hanging the suite. */
function runToTarget(candidates: readonly number[], target: number): { value: number; steps: number } {
  let state: SearchState = createSearch(candidates);
  let steps = 0;
  const cap = candidates.length + 5;
  while (!isDone(state)) {
    const pair = currentPair(state);
    if (!pair) break;
    state = choose(state, preferCloserTo(target, pair));
    steps += 1;
    if (steps > cap) throw new Error(`did not converge within ${cap} steps`);
  }
  return { value: result(state), steps };
}

describe('preferenceSearch', () => {
  it('rejects a candidate list with fewer than 2 values', () => {
    expect(() => createSearch([5])).toThrow();
    expect(() => createSearch([])).toThrow();
  });

  it('still runs one real comparison with exactly 2 candidates (never picks silently)', () => {
    const state = createSearch([10, 20]);
    expect(isDone(state)).toBe(false);
    const pair = currentPair(state)!;
    expect([pair.a, pair.b].sort()).toEqual([10, 20]);
    const afterA = choose(state, 'a');
    expect(isDone(afterA)).toBe(true);
    expect(result(afterA)).toBe(pair.a);
  });

  it('currentPair always returns two distinct real candidates while not done', () => {
    const candidates = [3, 9, 15, 21, 28, 34, 40];
    let state = createSearch(candidates);
    while (!isDone(state)) {
      const pair = currentPair(state)!;
      expect(candidates).toContain(pair.a);
      expect(candidates).toContain(pair.b);
      expect(pair.a).not.toBe(pair.b);
      state = choose(state, 'a'); // direction doesn't matter for this check
    }
  });

  it('choose() on an already-done state is a no-op', () => {
    let state = createSearch([10, 20]);
    state = choose(state, 'a'); // one real comparison needed even for 2 candidates
    expect(isDone(state)).toBe(true);
    expect(choose(state, 'b')).toEqual(state);
  });

  it.each([3, 4, 5, 6, 7, 8, 10, 12])(
    'always terminates for a %i-candidate list under every fixed choice',
    (n) => {
      const candidates = Array.from({ length: n }, (_, i) => i * 10);
      (['a', 'b', 'same'] as PreferenceChoice[]).forEach((fixedChoice) => {
        let state = createSearch(candidates);
        let steps = 0;
        const cap = n + 5;
        while (!isDone(state)) {
          state = choose(state, fixedChoice);
          steps += 1;
          expect(steps).toBeLessThanOrEqual(cap);
        }
      });
    },
  );

  it('converges to the candidate closest to a preferred target (depth-like range)', () => {
    const candidates = [3, 9, 15, 21, 28, 34, 40]; // mirrors ATTEN candidates
    for (const target of [3, 10, 20, 21, 30, 40]) {
      const { value, steps } = runToTarget(candidates, target);
      const closest = candidates.reduce((best, c) =>
        Math.abs(c - target) < Math.abs(best - target) ? c : best,
      );
      expect(value).toBe(closest);
      expect(steps).toBeLessThan(candidates.length);
    }
  });

  it('converges to the candidate closest to a preferred target (width-like range)', () => {
    const candidates = [1, 3, 6, 10, 14, 17, 20]; // mirrors Q candidates
    for (const target of [1, 4, 12, 20]) {
      const { value } = runToTarget(candidates, target);
      const closest = candidates.reduce((best, c) =>
        Math.abs(c - target) < Math.abs(best - target) ? c : best,
      );
      expect(value).toBe(closest);
    }
  });

  it('an indifferent user ("same" every time) still reaches a definite answer', () => {
    const candidates = [3, 9, 15, 21, 28, 34, 40];
    let state = createSearch(candidates);
    let steps = 0;
    while (!isDone(state)) {
      state = choose(state, 'same');
      steps += 1;
      expect(steps).toBeLessThan(candidates.length);
    }
    expect(candidates).toContain(result(state));
  });
});
