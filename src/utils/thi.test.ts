import { THI_ITEM_COUNT } from '../constants/outcomes';
import { ThiAnswer } from '../types';
import {
  scoreThi,
  scoreThiSubscales,
  THI_ITEMS,
  THI_MCID_POINTS,
  thiGrade,
  thiTrend,
} from './thi';

const all = (a: ThiAnswer): ThiAnswer[] => Array.from({ length: THI_ITEM_COUNT }, () => a);

describe('THI structure', () => {
  it('has 25 items with the published 12/8/5 subscale split', () => {
    expect(THI_ITEMS).toHaveLength(25);
    const counts = { F: 0, E: 0, C: 0 };
    THI_ITEMS.forEach((i) => (counts[i.subscale] += 1));
    expect(counts).toEqual({ F: 12, E: 8, C: 5 });
    expect(new Set(THI_ITEMS.map((i) => i.key)).size).toBe(25);
  });
});

describe('scoreThi', () => {
  it('scores yes/sometimes/no as 4/2/0 for a 0–100 total', () => {
    expect(scoreThi(all('yes'))).toBe(100);
    expect(scoreThi(all('sometimes'))).toBe(50);
    expect(scoreThi(all('no'))).toBe(0);
  });

  it('refuses incomplete answer sets', () => {
    expect(() => scoreThi(all('no').slice(0, 24))).toThrow(/25 answers/);
  });

  it('subscale totals add up to the total', () => {
    const answers = all('no').map((_, i) => (i % 3 === 0 ? 'yes' : i % 3 === 1 ? 'sometimes' : 'no')) as ThiAnswer[];
    const sub = scoreThiSubscales(answers);
    expect(sub.F + sub.E + sub.C).toBe(scoreThi(answers));
  });
});

describe('grade and trend', () => {
  it('maps totals to the published grades', () => {
    expect(thiGrade(0)).toBe('slight');
    expect(thiGrade(16)).toBe('slight');
    expect(thiGrade(18)).toBe('mild');
    expect(thiGrade(36)).toBe('mild');
    expect(thiGrade(38)).toBe('moderate');
    expect(thiGrade(56)).toBe('moderate');
    expect(thiGrade(58)).toBe('severe');
    expect(thiGrade(76)).toBe('severe');
    expect(thiGrade(78)).toBe('catastrophic');
    expect(thiGrade(100)).toBe('catastrophic');
  });

  it('only calls a change when it clears the MCID', () => {
    expect(thiTrend(50, 50 - THI_MCID_POINTS)).toBe('better');
    expect(thiTrend(50, 50 + THI_MCID_POINTS)).toBe('worse');
    expect(thiTrend(50, 50 - (THI_MCID_POINTS - 1))).toBe('same');
    expect(thiTrend(50, 50 + (THI_MCID_POINTS - 1))).toBe('same');
  });
});
