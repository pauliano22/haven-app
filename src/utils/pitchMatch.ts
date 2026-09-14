import {
  MATCH_PITCH_CONVERGENCE_RATIO,
  MATCH_PITCH_MAX_HZ,
  MATCH_PITCH_MAX_TRIALS,
  MATCH_PITCH_MIN_HZ,
  MATCH_PITCH_MIN_TRIALS,
} from '../constants/safety';

/**
 * Adaptive two-alternative-forced-choice pitch matching, done as a bisection
 * search in log-frequency space (self-guided multiple-choice matching has
 * been shown about as reliable as clinician-administered pitch matching —
 * see the product notes this feature was scoped from).
 *
 * Each trial offers two candidate tones drawn from the inner third-points of
 * the current [lowHz, highHz] bracket, so whichever the user picks as
 * "closer" narrows the bracket to two-thirds of its former (log) width.
 */

export interface PitchBracket {
  lowHz: number;
  highHz: number;
}

export function initialBracket(): PitchBracket {
  return { lowHz: MATCH_PITCH_MIN_HZ, highHz: MATCH_PITCH_MAX_HZ };
}

/** The two comparison tones to offer for the current bracket. */
export function nextTrialPair(bracket: PitchBracket): { fA: number; fB: number } {
  const { lowHz, highHz } = bracket;
  const mid = Math.sqrt(lowHz * highHz);
  return {
    fA: Math.sqrt(lowHz * mid),
    fB: Math.sqrt(mid * highHz),
  };
}

/** Narrow the bracket toward whichever candidate the user chose as closer. */
export function narrowBracket(bracket: PitchBracket, choice: 'A' | 'B'): PitchBracket {
  const mid = Math.sqrt(bracket.lowHz * bracket.highHz);
  return choice === 'A' ? { lowHz: bracket.lowHz, highHz: mid } : { lowHz: mid, highHz: bracket.highHz };
}

/** Whether the search should stop after this many completed trials. */
export function isConverged(bracket: PitchBracket, trialsCompleted: number): boolean {
  if (trialsCompleted >= MATCH_PITCH_MAX_TRIALS) return true;
  if (trialsCompleted < MATCH_PITCH_MIN_TRIALS) return false;
  return bracket.highHz / bracket.lowHz <= MATCH_PITCH_CONVERGENCE_RATIO;
}

/** Best single-frequency estimate for a bracket — its log-space midpoint. */
export function matchedFrequency(bracket: PitchBracket): number {
  return Math.round(Math.sqrt(bracket.lowHz * bracket.highHz));
}

// ── Octave-confusion check ──────────────────────────────────────────────────
//
// Tinnitus pitch matches are notoriously off by exactly an octave: the
// bisection above converges on *a* pitch the user accepts, but a tone one
// octave away often sounds just as right, and clinical protocols end with an
// explicit octave check for that reason (docs/clinical-basis.md §1a). So
// after convergence the user hears the match against f/2 and 2f once, and
// the bracket is re-centred if they pick a neighbour.

export type OctaveChoice = 'lower' | 'match' | 'upper';

export interface OctaveCandidates {
  /** f/2, or null if it falls below the searchable range. */
  lowerHz: number | null;
  /** 2f, or null if it falls above the searchable range. */
  upperHz: number | null;
}

export function octaveCandidates(f0Hz: number): OctaveCandidates {
  const lower = f0Hz / 2;
  const upper = f0Hz * 2;
  return {
    lowerHz: lower >= MATCH_PITCH_MIN_HZ ? Math.round(lower) : null,
    upperHz: upper <= MATCH_PITCH_MAX_HZ ? Math.round(upper) : null,
  };
}

/**
 * Re-centre a converged bracket on the octave neighbour the user chose,
 * keeping its (log) width so matchedFrequency() stays as precise as the
 * search that produced it. 'match' returns the bracket unchanged. The result
 * is clamped to the searchable range; if the chosen neighbour is out of
 * range (octaveCandidates would have returned null for it) the bracket is
 * also returned unchanged.
 */
export function applyOctaveChoice(bracket: PitchBracket, choice: OctaveChoice): PitchBracket {
  if (choice === 'match') return bracket;
  const f0 = Math.sqrt(bracket.lowHz * bracket.highHz);
  const target = choice === 'lower' ? f0 / 2 : f0 * 2;
  if (target < MATCH_PITCH_MIN_HZ || target > MATCH_PITCH_MAX_HZ) return bracket;

  const halfRatio = Math.sqrt(bracket.highHz / bracket.lowHz);
  return {
    lowHz: Math.max(MATCH_PITCH_MIN_HZ, target / halfRatio),
    highHz: Math.min(MATCH_PITCH_MAX_HZ, target * halfRatio),
  };
}
