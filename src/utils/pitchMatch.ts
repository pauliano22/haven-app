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
