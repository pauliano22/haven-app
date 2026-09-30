/**
 * Adjusts how long to wait before the next tolerance-building step becomes
 * available to tap, based on the most recent comfort check-in responses
 * since the plan's last step.
 *
 * NOT a bandit or a learned model, and deliberately not built as one. The
 * depth/width preference tuner (preferenceSearch.ts) fits a real bandit
 * because it gets many comparisons in one sitting; this data is nothing
 * like that -- one comfort response at most per day, tolerance steps a
 * week apart, so a real plan produces at most one or two comfort responses
 * between steps. There's no meaningful exploration/exploitation tradeoff at
 * that data density, and pretending otherwise would be dishonest, not more
 * capable. This is the honest tool for this data scale: a plain rule over
 * the last couple of responses.
 *
 * The rule: two most recent responses both 'weaker' (too strong -- the
 * person needs more protection than the plan currently assumes) doubles
 * the wait before the next step is offered. Two most recent both 'same' or
 * 'stronger' (comfortable, or wanting even less softening) halves it, down
 * to a floor. Mixed, or fewer than two responses: unchanged. This only ever
 * changes how soon the next step becomes available to tap -- it never
 * advances a step automatically, preserving constants/tolerance.ts's
 * existing invariant (explicit confirmation only, always stoppable).
 */
import { ComfortDirection } from '../components/ComfortCheckIn';

/** Never offer the next step sooner than this, no matter how comfortable
 * recent responses were -- a floor against a plan racing ahead of someone
 * who could still be over-protecting without realizing it. */
export const MIN_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;

/** Never push the next step out further than this from a run of 'too
 * strong' responses -- a ceiling so the plan doesn't effectively stall
 * forever; someone who keeps saying it's too strong should also see that
 * reflected in the plan pacing out, not silently freezing. */
export const MAX_INTERVAL_MS = 28 * 24 * 60 * 60 * 1000;

export function computeNextIntervalMs(
  baseIntervalMs: number,
  /** Directions since the plan's last step, oldest first -- only the last
   * two are used. */
  recentDirections: readonly ComfortDirection[],
): number {
  if (recentDirections.length < 2) return baseIntervalMs;

  const lastTwo = recentDirections.slice(-2);
  const bothWeaker = lastTwo.every((d) => d === 'weaker');
  const bothComfortableOrLess = lastTwo.every((d) => d === 'same' || d === 'stronger');

  if (bothWeaker) return Math.min(MAX_INTERVAL_MS, baseIntervalMs * 2);
  if (bothComfortableOrLess) return Math.max(MIN_INTERVAL_MS, Math.floor(baseIntervalMs / 2));
  return baseIntervalMs; // mixed signal -- no confident adjustment either way
}
