/**
 * A small preference-guided search over an ordered list of candidate values
 * for ONE tuning dimension at a time (e.g. softening depth, or width).
 *
 * This is NOT a trained/learned model — see ML_RL_FEASIBILITY.md in
 * haven-zephyr-app for why that distinction matters. It presents two
 * candidates, asks which the user prefers, and narrows a bracket toward
 * the winner (a ternary-search-style shrink), the same way you'd binary
 * search for a value except the "comparison" is a person's preference
 * instead of a number.
 *
 * Precedent: commercial hearing aids (e.g. Widex SoundSense Learn) use
 * repeated A/B preference comparisons to converge on a personal setting
 * across a large parameter space in roughly a dozen comparisons, instead of
 * either exhaustive search or a single manual guess. This is a much
 * smaller, from-scratch version of that idea, scoped to one dimension at a
 * time over a short, explicit candidate list.
 *
 * Assumption (stated, not hidden): the person's preference over a given
 * dimension has a single "sweet spot" (is unimodal) — e.g. for softening
 * depth, both too little and too much are worse than some middle value.
 * That's a reasonable starting assumption for a depth/width control, not a
 * guarantee for every person or every dimension. If it's wrong for someone,
 * the search can converge on a locally-preferred point that isn't their
 * true favorite — the manual sliders remain available afterward regardless.
 */

export type PreferenceChoice = 'a' | 'b' | 'same';

export interface SearchState {
  readonly candidates: readonly number[];
  readonly lo: number;
  readonly hi: number;
}

export interface ComparisonPair {
  a: number;
  b: number;
}

export function createSearch(candidates: readonly number[]): SearchState {
  if (candidates.length < 2) {
    throw new Error('createSearch needs at least 2 candidates');
  }
  return { candidates, lo: 0, hi: candidates.length - 1 };
}

/** Done once the bracket has collapsed to a single candidate. Anything
 * looser (e.g. stopping at 2 remaining candidates without ever comparing
 * them directly) can silently keep the wrong one — caught by a real test
 * failure at the edge of the range during development; don't loosen this. */
export function isDone(state: SearchState): boolean {
  return state.lo === state.hi;
}

/** The two candidate values to present next, or null once the search is done. */
export function currentPair(state: SearchState): ComparisonPair | null {
  if (isDone(state)) return null;
  const { candidates, lo, hi } = state;
  const span = hi - lo;

  // 1 or 2 candidates remain besides the endpoints already known to be in
  // play -- not enough room for distinct *interior* points, so compare the
  // ends directly. (span === 1: this *is* the final decisive comparison.
  // span === 2: the middle is left untested here on purpose -- whichever
  // end loses is dropped, and the middle gets its own direct comparison
  // next round, never assumed the winner.)
  if (span <= 2) {
    return { a: candidates[lo], b: candidates[hi] };
  }

  const third = Math.max(1, Math.floor(span / 3));
  return { a: candidates[lo + third], b: candidates[hi - third] };
}

/** Narrow the bracket based on which of the current pair was preferred. */
export function choose(state: SearchState, pick: PreferenceChoice): SearchState {
  const pair = currentPair(state);
  if (!pair) return state; // already done -- no-op

  const { candidates, lo, hi } = state;
  const span = hi - lo;

  if (span === 1) {
    if (pick === 'a') return { candidates, lo, hi: lo };
    if (pick === 'b') return { candidates, lo: hi, hi };
    // 'same' on the last remaining pair: no signal to break the tie with --
    // keep the lower one, by documented convention, rather than picking
    // arbitrarily.
    return { candidates, lo, hi: lo };
  }

  if (span === 2) {
    const mid = lo + 1;
    if (pick === 'a') return { candidates, lo, hi: mid }; // drop the hi end; mid still needs its own compare
    if (pick === 'b') return { candidates, lo: mid, hi }; // drop the lo end
    return { candidates, lo: mid, hi: mid }; // 'same' between the ends -- take the untested middle
  }

  const third = Math.max(1, Math.floor(span / 3));
  const ai = lo + third;
  const bi = hi - third;

  if (pick === 'a') return { candidates, lo, hi: bi };
  if (pick === 'b') return { candidates, lo: ai, hi };
  // 'same' -- no signal either way; drop both outer thirds and keep the
  // middle, so the search still makes guaranteed progress instead of
  // looping on an indifferent answer.
  return { candidates, lo: ai, hi: bi };
}

/** The converged value. Only meaningful once isDone(state) is true. */
export function result(state: SearchState): number {
  return state.candidates[state.lo];
}
