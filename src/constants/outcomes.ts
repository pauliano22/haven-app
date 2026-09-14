// ── Outcome measurement & the N-of-1 trial ──────────────────────────────────
//
// Haven can honestly claim very little until it measures whether it helps.
// These constants define the two instruments the app collects (a weekly
// 0–10 VAS pair and the Tinnitus Handicap Inventory) and the shape of the
// opt-in N-of-1 trial (alternating "active" and "paused" days). Nothing here
// leaves the phone unless the user exports it (docs/safety.md, "Your data").

const DAY_MS = 24 * 60 * 60 * 1000;

/** Weekly VAS check-in: two 0–10 ratings (loudness, bother). */
export const VAS_INTERVAL_MS = 7 * DAY_MS;

/** THI: baseline at first use of the check-in tool, then monthly. */
export const THI_INTERVAL_MS = 30 * DAY_MS;

/** THI scoring per Newman, Jacobson & Spitzer (1996): yes 4, sometimes 2, no 0. */
export const THI_POINTS = { yes: 4, sometimes: 2, no: 0 } as const;
export const THI_ITEM_COUNT = 25;

/**
 * N-of-1 trial: alternating days in randomised blocks of two (AB or BA), so
 * neither arm systematically lands on weekdays/weekends. Four weeks gives
 * 14 days per arm, which is also the minimum before the results view is
 * allowed to talk about a difference at all.
 */
export const NOF1_TRIAL_DAYS = 28;
export const NOF1_BLOCK_DAYS = 2;
export const NOF1_MIN_DAYS_PER_ARM = 14;

/** Exposure log: bounded, rolling. */
export const EXPOSURE_LOG_MAX_EVENTS = 2000;

/** Consent text version; bump when the wording changes materially. */
export const CONSENT_VERSION = 1;
