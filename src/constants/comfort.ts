// ── Adaptive comfort check-in ────────────────────────────────────────────────
//
// A simple nudge, not a real ML model: after enough time has passed with a
// band active, ask a plain three-way question and adjust attenDb by one
// fixed step in the reported direction. No inference, no per-user model
// beyond "which way did they last nudge it" — honest about what this is.

/** Don't ask again until this much time has passed since the last prompt/response. */
export const COMFORT_PROMPT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** How far one "too strong"/"not enough" response moves attenDb. */
export const COMFORT_ADJUST_STEP_DB = 3;
