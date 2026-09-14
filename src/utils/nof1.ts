import {
  NOF1_BLOCK_DAYS,
  NOF1_MIN_DAYS_PER_ARM,
  NOF1_TRIAL_DAYS,
} from '../constants/outcomes';
import { Nof1Trial, TrialArm } from '../types';

/**
 * N-of-1 trial: the one design that gives a single user a real answer about
 * *their* benefit. Days alternate between "active" (softening on) and
 * "bypass" (protection paused) in randomised two-day blocks; the user rates
 * bother 0–10 each day; at the end the two arms' means are compared. Because
 * the device already has BYPASS, the whole thing is a schedule plus a rating.
 *
 * Deliberately conservative language: no p-values, no "works" — with n = 14
 * per arm this is evidence for one person, not a study. The user can always
 * switch protection manually; we log that as an override and attribute the
 * day to what they actually did.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole local days from `startDay` to the day containing `timestamp`. */
export function dayIndex(startDay: string, timestamp: number): number {
  const [y, m, d] = startDay.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const t = new Date(timestamp);
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((today - start) / DAY_MS);
}

/** Small deterministic PRNG (mulberry32) so schedules are reproducible in tests. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Randomised blocks (AB or BA) covering `days`; each arm gets exactly half. */
export function generateSchedule(days: number = NOF1_TRIAL_DAYS, rng: () => number = Math.random): TrialArm[] {
  const schedule: TrialArm[] = [];
  const blocks = Math.ceil(days / NOF1_BLOCK_DAYS);
  for (let b = 0; b < blocks; b++) {
    const first: TrialArm = rng() < 0.5 ? 'active' : 'bypass';
    const second: TrialArm = first === 'active' ? 'bypass' : 'active';
    schedule.push(first, second);
  }
  return schedule.slice(0, days);
}

export function startTrial(now: number = Date.now(), rng?: () => number): Nof1Trial {
  return {
    startedAt: now,
    startDay: dayKey(now),
    schedule: generateSchedule(NOF1_TRIAL_DAYS, rng),
    ratings: {},
    overrides: [],
    stoppedAt: null,
  };
}

/** The arm scheduled for the day containing `timestamp`, or null outside the trial window. */
export function assignmentFor(trial: Nof1Trial, timestamp: number): TrialArm | null {
  if (trial.stoppedAt !== null && timestamp > trial.stoppedAt) return null;
  const i = dayIndex(trial.startDay, timestamp);
  if (i < 0 || i >= trial.schedule.length) return null;
  return trial.schedule[i];
}

export function isComplete(trial: Nof1Trial, timestamp: number): boolean {
  return trial.stoppedAt !== null || dayIndex(trial.startDay, timestamp) >= trial.schedule.length;
}

/** The arm the user actually ran on a day: the assignment unless they overrode it that day. */
export function effectiveArm(trial: Nof1Trial, day: string): TrialArm | null {
  const idx = trial.schedule.findIndex((_, i) => dayKeyFromIndex(trial.startDay, i) === day);
  if (idx < 0) return null;
  const override = [...trial.overrides].reverse().find((o) => o.day === day);
  return override ? override.chosen : trial.schedule[idx];
}

export function dayKeyFromIndex(startDay: string, index: number): string {
  const [y, m, d] = startDay.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + index).getTime());
}

export interface ArmSummary {
  n: number;
  mean: number | null;
}

export interface TrialSummary {
  active: ArmSummary;
  bypass: ArmSummary;
  /** active − bypass on the 0–10 bother scale; negative favours softening. */
  difference: number | null;
  /** Both arms reached NOF1_MIN_DAYS_PER_ARM rated days. */
  sufficient: boolean;
  overrideDays: number;
  sentence: string;
}

function summarise(values: number[]): ArmSummary {
  if (values.length === 0) return { n: 0, mean: null };
  return { n: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length };
}

/**
 * Attribute each rated day to the arm the user actually ran, then compare
 * means. Only speaks about a "difference" once both arms have at least
 * NOF1_MIN_DAYS_PER_ARM ratings, and only calls it meaningful when it clears
 * one full point on the 0–10 scale (a smaller gap is inside day-to-day noise
 * for a single rater).
 */
export function summariseTrial(trial: Nof1Trial): TrialSummary {
  const byArm: Record<TrialArm, number[]> = { active: [], bypass: [] };
  let overrideDays = 0;
  for (const [day, rating] of Object.entries(trial.ratings)) {
    const arm = effectiveArm(trial, day);
    if (!arm) continue;
    byArm[arm].push(rating);
    if (trial.overrides.some((o) => o.day === day)) overrideDays += 1;
  }
  const active = summarise(byArm.active);
  const bypass = summarise(byArm.bypass);
  const sufficient = active.n >= NOF1_MIN_DAYS_PER_ARM && bypass.n >= NOF1_MIN_DAYS_PER_ARM;
  const difference = active.mean !== null && bypass.mean !== null ? active.mean - bypass.mean : null;

  let sentence: string;
  if (!sufficient) {
    sentence =
      `Not enough days yet to compare — ${active.n} rated with softening on and ${bypass.n} with it ` +
      `paused. Keep going until each has at least ${NOF1_MIN_DAYS_PER_ARM}.`;
  } else if (difference === null) {
    sentence = 'Not enough ratings to compare.';
  } else if (difference <= -1) {
    sentence =
      `On your softening days you rated bother about ${Math.abs(difference).toFixed(1)} points lower ` +
      `(out of 10) than on paused days. For you, softening looks like it helps — this is one ` +
      `person's four weeks, not a study, so treat it as a strong hint, not proof.`;
  } else if (difference >= 1) {
    sentence =
      `On your softening days you rated bother about ${difference.toFixed(1)} points higher than on ` +
      `paused days. Softening may not be helping you right now — worth discussing, and worth ` +
      `pausing for a while.`;
  } else {
    sentence =
      `Your ratings were about the same with softening on and off (a gap of ${Math.abs(difference).toFixed(1)} ` +
      `out of 10). That's within day-to-day noise, so this trial doesn't show a benefit either way.`;
  }
  if (overrideDays > 0) {
    sentence += ` (${overrideDays} day${overrideDays === 1 ? '' : 's'} counted as what you actually chose, not the plan.)`;
  }
  return { active, bypass, difference, sufficient, overrideDays, sentence };
}
