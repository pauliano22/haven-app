import { THI_ITEM_COUNT, THI_POINTS } from '../constants/outcomes';
import { ThiAnswer } from '../types';

/**
 * Tinnitus Handicap Inventory (Newman, Jacobson & Spitzer, 1996): 25 items
 * answered yes / sometimes / no, scored 4 / 2 / 0, total 0–100. Widely used
 * as a tinnitus outcome measure, which is why Haven collects it at baseline
 * and monthly.
 *
 * TODO(licensing): the item WORDING is the authors'/publisher's copyright
 * (Arch Otolaryngol Head Neck Surg 1996;122:143-148) and is not reproduced
 * here. Before the questionnaire is shown to anyone outside the team, either
 * (a) confirm the terms under which the items may be used in an app (many
 * research uses are permitted; commercial distribution is not automatically),
 * or (b) substitute a freely licensed instrument. `THI_ITEMS` carries only the
 * published subscale structure (F functional, E emotional, C catastrophic)
 * and neutral placeholder prompts so the scoring, persistence and trend
 * plumbing can be built and tested now.
 */
export type ThiSubscale = 'F' | 'E' | 'C';

export interface ThiItem {
  key: string;
  subscale: ThiSubscale;
  /** Placeholder prompt — see the licensing TODO above. */
  prompt: string;
}

const SUBSCALES: ThiSubscale[] = [
  'F', 'F', 'E', 'F', 'C', 'E', 'F', 'C', 'F', 'E',
  'C', 'F', 'F', 'E', 'F', 'E', 'E', 'F', 'C', 'F',
  'E', 'F', 'C', 'F', 'E',
];

export const THI_ITEMS: readonly ThiItem[] = SUBSCALES.map((subscale, i) => ({
  key: `thi_${String(i + 1).padStart(2, '0')}`,
  subscale,
  prompt: `Question ${i + 1} of ${THI_ITEM_COUNT}`,
}));

export function scoreAnswer(answer: ThiAnswer): number {
  return THI_POINTS[answer];
}

/** Total 0–100; throws if the answer set is incomplete (the UI must not save partials). */
export function scoreThi(answers: ThiAnswer[]): number {
  if (answers.length !== THI_ITEM_COUNT) {
    throw new Error(`THI needs ${THI_ITEM_COUNT} answers, got ${answers.length}`);
  }
  return answers.reduce((sum, a) => sum + scoreAnswer(a), 0);
}

export interface ThiSubscaleScores {
  F: number;
  E: number;
  C: number;
}

export function scoreThiSubscales(answers: ThiAnswer[]): ThiSubscaleScores {
  const out: ThiSubscaleScores = { F: 0, E: 0, C: 0 };
  answers.forEach((a, i) => {
    const item = THI_ITEMS[i];
    if (item) out[item.subscale] += scoreAnswer(a);
  });
  return out;
}

/**
 * Severity grade (Newman, Sandridge & Jacobson, 1998). Totals are always even,
 * so the published band gaps (17, 37, …) can't be hit.
 */
export type ThiGrade = 'slight' | 'mild' | 'moderate' | 'severe' | 'catastrophic';

export function thiGrade(total: number): ThiGrade {
  if (total <= 16) return 'slight';
  if (total <= 36) return 'mild';
  if (total <= 56) return 'moderate';
  if (total <= 76) return 'severe';
  return 'catastrophic';
}

/**
 * Smallest change worth calling a change. Zeman et al. (2011) estimated the
 * THI's minimal clinically important difference at 7 points; anything smaller
 * is within measurement noise and the trend view says "about the same".
 */
export const THI_MCID_POINTS = 7;

export function thiTrend(previousTotal: number, latestTotal: number): 'better' | 'worse' | 'same' {
  const delta = latestTotal - previousTotal;
  if (delta <= -THI_MCID_POINTS) return 'better';
  if (delta >= THI_MCID_POINTS) return 'worse';
  return 'same';
}
