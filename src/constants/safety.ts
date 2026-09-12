// ── Hard-coded output safety limits ─────────────────────────────────────────
//
// These constants are the single choke point for every tone level the app can
// command the hardware to produce. They are intentionally NOT configurable at
// runtime, not stored in state, and not adjustable from any screen. If you are
// editing these values you are making a clinical-safety decision — get it
// reviewed.
//
// The firmware must enforce its own independent ceiling; this cap is the
// app-side layer of a defense-in-depth pair.

/** Absolute ceiling for any commanded tone level. Nothing may exceed this. */
export const MAX_TONE_LEVEL_DB = 85;

/** Level every LDL ramp starts from — comfortably quiet for normal hearing. */
export const LDL_START_LEVEL_DB = 30;

/** Ramp increment per step. Small steps keep the approach to discomfort slow. */
export const LDL_RAMP_STEP_DB = 2;

/** Dwell time at each level before the next increment. */
export const LDL_RAMP_INTERVAL_MS = 700;

/**
 * Fail-safe: a tone auto-stops this long after starting even if the user
 * touches nothing (covers a frozen UI, a distracted user, a stuck timer).
 */
export const LDL_MAX_TONE_DURATION_MS = 25000;

/** Frequencies swept by the LDL test, in presentation order. */
export const LDL_TEST_FREQUENCIES_HZ = [1000, 2000, 3000, 4000, 6000, 8000];

// ── "Match your sound" (pitch/loudness matching) ────────────────────────────
//
// Unlike the LDL test, this never approaches discomfort — every tone here is
// a short, fixed-duration burst at a comfortable, capped level. There is no
// ramp and therefore no need for a keep-alive loop: BURST_MAX_DURATION_MS is
// kept well under the firmware's 3s TONE_LEVEL watchdog (see safety.md) so a
// single TONE_START/TONE_STOP pair per burst is always safe on its own.

/** Fixed presentation level for pitch-matching comparison tones. */
export const MATCH_PITCH_TONE_LEVEL_DB = 55;

/** How long each pitch-comparison or loudness-preview burst plays. */
export const MATCH_BURST_DURATION_MS = 1400;

/** Loudness-match slider range — comfortable range, well below the LDL/discomfort zone. */
export const MATCH_LOUDNESS_MIN_DB = 10;
export const MATCH_LOUDNESS_MAX_DB = 70;
export const MATCH_LOUDNESS_START_DB = 30;

/** Pitch-match adaptive search bounds — mirrors the DSP's own f0 range. */
export const MATCH_PITCH_MIN_HZ = 200;
export const MATCH_PITCH_MAX_HZ = 8000;
/** Trial count bounds: enough to converge, few enough to not fatigue the user. */
export const MATCH_PITCH_MIN_TRIALS = 5;
export const MATCH_PITCH_MAX_TRIALS = 8;
/** Stop early once the search bracket narrows to within this ratio. */
export const MATCH_PITCH_CONVERGENCE_RATIO = 1.15;

/**
 * Clamp a requested tone level into the permitted range.
 * All tone payload construction MUST route through this function.
 */
export function clampToneLevel(levelDb: number): number {
  if (!Number.isFinite(levelDb)) return LDL_START_LEVEL_DB;
  if (levelDb > MAX_TONE_LEVEL_DB) return MAX_TONE_LEVEL_DB;
  if (levelDb < 0) return 0;
  return levelDb;
}
