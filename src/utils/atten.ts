import { ATTEN_MAX_DB, ATTEN_MIN_DB } from '../constants/dsp';

/**
 * One source of truth for what an `attenDb` of 0 means. Three features can
 * put a band there — the tolerance plan's final step, the LDL-drift "pause
 * this band", and now the Softening slider itself — so they must agree:
 * 0 dB is a *paused* band (flat response, kept in the list so its frequency
 * isn't lost), anything from ATTEN_MIN_DB up is active softening. Values in
 * (0, ATTEN_MIN_DB) are never produced on purpose; `normalizeAtten` snaps
 * them to the floor so the UI and the wire never disagree.
 */
export const ATTEN_PAUSED_DB = 0;

export function isPaused(attenDb: number): boolean {
  return attenDb <= ATTEN_PAUSED_DB;
}

/** Snap any requested depth to {0} ∪ [ATTEN_MIN_DB, ATTEN_MAX_DB]. */
export function normalizeAtten(attenDb: number): number {
  if (!Number.isFinite(attenDb) || attenDb <= 0) return ATTEN_PAUSED_DB;
  if (attenDb < ATTEN_MIN_DB) return ATTEN_MIN_DB;
  if (attenDb > ATTEN_MAX_DB) return ATTEN_MAX_DB;
  return Math.round(attenDb);
}

/**
 * Nudge from the comfort check-in. A nudge never pauses a band (pausing is a
 * deliberate act, offered by the drift card / plan), and "not enough" on a
 * paused band resumes it at the gentlest active depth.
 */
export function nudgeAtten(attenDb: number, deltaDb: number): number {
  if (isPaused(attenDb)) return deltaDb > 0 ? ATTEN_MIN_DB : ATTEN_PAUSED_DB;
  return Math.min(ATTEN_MAX_DB, Math.max(ATTEN_MIN_DB, Math.round(attenDb + deltaDb)));
}

/** Tolerance-plan step: reduce by `stepDb`, landing on 0 when the step crosses the floor. */
export function stepDownAtten(attenDb: number, stepDb: number): number {
  const next = attenDb - stepDb;
  return next < ATTEN_MIN_DB ? ATTEN_PAUSED_DB : Math.round(next);
}

export function attenLabel(attenDb: number): string {
  if (isPaused(attenDb)) return 'Paused — no softening';
  if (attenDb >= ATTEN_MAX_DB) return 'Fully softened';
  if (attenDb >= 25) return 'Strongly softened';
  if (attenDb >= 12) return 'Moderately softened';
  return 'Gently softened';
}
