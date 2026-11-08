import { DIARY_BAND_COUNT, DIARY_BAND_EDGES_HZ, DiaryFrame } from './soundFeatures';

/**
 * Which features of the room's sound line up with the moments the person
 * tapped "that hurt", compared with the moments they tapped "that was fine"?
 *
 * This is a descriptive tool, not a diagnosis and not a learned model. With
 * a handful of taps it can only say "this looks related, keep logging". It
 * says nothing at all until there are enough taps of both kinds.
 */

export interface DiaryMark {
  timestamp: number;
  kind: 'hurt' | 'fine';
}

/** Seconds of sound before a tap that count as "the moment". */
export const NOW_WINDOW_MS = 30_000;
/** Longer look-back for "how much sound in the last while". */
export const RECENT_WINDOW_MS = 10 * 60_000;
/** Taps of each kind needed before any result is shown. */
export const MIN_MARKS_EACH = 5;
/** |AUC - 0.5| at or above this is reported as a possible link. */
export const SUGGESTIVE_AUC_DISTANCE = 0.25;

export type FeatureId =
  | 'level_now'
  | 'level_peak'
  | 'sudden_rise'
  | 'recent_exposure'
  | `band_${number}`;

export interface MarkFeatures {
  mark: DiaryMark;
  values: Partial<Record<FeatureId, number>>;
}

export interface FeatureResult {
  id: FeatureId;
  label: string;
  /**
   * Probability that a random "hurt" moment has a higher value of this
   * feature than a random "fine" moment. 0.5 means no relation; near 1 means
   * hurt moments are higher; near 0 means they are lower.
   */
  auc: number;
  hurtMean: number;
  fineMean: number;
  suggestive: boolean;
}

export type TriggerAnalysis =
  | { status: 'not_enough_data'; hurtMarks: number; fineMarks: number; needEach: number }
  | { status: 'ok'; hurtMarks: number; fineMarks: number; results: FeatureResult[] };

function bandLabel(b: number): string {
  const lo = DIARY_BAND_EDGES_HZ[b];
  const hi = DIARY_BAND_EDGES_HZ[b + 1];
  const fmt = (hz: number) => (hz >= 1000 ? `${Math.round(hz / 100) / 10} kHz` : `${Math.round(hz)} Hz`);
  return `Sound between ${fmt(lo)} and ${fmt(hi)}`;
}

export function featureLabel(id: FeatureId): string {
  switch (id) {
    case 'level_now':
      return 'How loud it was';
    case 'level_peak':
      return 'The loudest moment';
    case 'sudden_rise':
      return 'How suddenly it got louder';
    case 'recent_exposure':
      return 'How much sound in the last 10 minutes';
    default:
      return bandLabel(Number(id.slice(5)));
  }
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Features for one tap, from the frames just before it. Null if no sound was logged then. */
export function featuresForMark(mark: DiaryMark, frames: DiaryFrame[]): MarkFeatures | null {
  const inWindow = frames
    .filter((f) => f.timestamp <= mark.timestamp && f.timestamp > mark.timestamp - NOW_WINDOW_MS)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (inWindow.length === 0) return null;

  const values: Partial<Record<FeatureId, number>> = {};
  values.level_now = mean(inWindow.map((f) => f.overallDb));
  values.level_peak = Math.max(...inWindow.map((f) => f.overallDb));

  let rise = 0;
  for (let i = 1; i < inWindow.length; i++) {
    const dt = (inWindow[i].timestamp - inWindow[i - 1].timestamp) / 1000;
    if (dt > 0) rise = Math.max(rise, (inWindow[i].overallDb - inWindow[i - 1].overallDb) / dt);
  }
  values.sudden_rise = rise;

  for (let b = 0; b < DIARY_BAND_COUNT; b++) {
    values[`band_${b}` as FeatureId] = mean(inWindow.map((f) => f.bands[b]));
  }

  const recent = frames.filter(
    (f) => f.timestamp <= mark.timestamp && f.timestamp > mark.timestamp - RECENT_WINDOW_MS,
  );
  if (recent.length > 0) values.recent_exposure = mean(recent.map((f) => f.overallDb));

  return { mark, values };
}

/** Mann-Whitney AUC: P(hurt > fine) + 0.5 * P(tie). */
export function auc(hurt: number[], fine: number[]): number {
  let wins = 0;
  for (const h of hurt) {
    for (const f of fine) {
      if (h > f) wins += 1;
      else if (h === f) wins += 0.5;
    }
  }
  return wins / (hurt.length * fine.length);
}

export function analyzeTriggers(marks: DiaryMark[], frames: DiaryFrame[]): TriggerAnalysis {
  const withFeatures = marks
    .map((m) => featuresForMark(m, frames))
    .filter((x): x is MarkFeatures => x !== null);
  const hurt = withFeatures.filter((x) => x.mark.kind === 'hurt');
  const fine = withFeatures.filter((x) => x.mark.kind === 'fine');

  if (hurt.length < MIN_MARKS_EACH || fine.length < MIN_MARKS_EACH) {
    return {
      status: 'not_enough_data',
      hurtMarks: hurt.length,
      fineMarks: fine.length,
      needEach: MIN_MARKS_EACH,
    };
  }

  const ids: FeatureId[] = ['level_now', 'level_peak', 'sudden_rise', 'recent_exposure'];
  for (let b = 0; b < DIARY_BAND_COUNT; b++) ids.push(`band_${b}` as FeatureId);

  const results: FeatureResult[] = [];
  for (const id of ids) {
    const h = hurt.map((x) => x.values[id]).filter((v): v is number => v !== undefined);
    const f = fine.map((x) => x.values[id]).filter((v): v is number => v !== undefined);
    if (h.length < MIN_MARKS_EACH || f.length < MIN_MARKS_EACH) continue;
    const a = auc(h, f);
    results.push({
      id,
      label: featureLabel(id),
      auc: a,
      hurtMean: mean(h),
      fineMean: mean(f),
      suggestive: Math.abs(a - 0.5) >= SUGGESTIVE_AUC_DISTANCE,
    });
  }
  results.sort((x, y) => Math.abs(y.auc - 0.5) - Math.abs(x.auc - 0.5));
  return { status: 'ok', hurtMarks: hurt.length, fineMarks: fine.length, results };
}
