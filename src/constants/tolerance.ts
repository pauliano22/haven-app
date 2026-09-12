// ── Tolerance-building plan ──────────────────────────────────────────────────
//
// Haven's DSP only ever filters real ambient sound (or plays a short safety-
// capped test tone) -- it has no broadband noise generator, so it can't
// implement clinical sound-generator-based hyperacusis therapy directly.
// What it *can* do honestly: help someone who has over-protected (a real,
// documented risk in hyperacusis -- avoiding all sound can worsen
// sensitivity) gradually reduce softening on one band over time, at their
// own pace, with an easy stop at any point. This is a structured nudge, not
// a clinical protocol -- always let the user confirm each step and stop
// anytime, never step down automatically without a tap.

/** Don't offer/require the next step until this much time has passed. */
export const TOLERANCE_STEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** How far one confirmed step reduces attenDb (less softening = building tolerance). */
export const TOLERANCE_STEP_DB = 3;
