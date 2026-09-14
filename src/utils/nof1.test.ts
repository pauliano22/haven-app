import { NOF1_MIN_DAYS_PER_ARM, NOF1_TRIAL_DAYS } from '../constants/outcomes';
import { Nof1Trial } from '../types';
import {
  assignmentFor,
  dayIndex,
  dayKey,
  dayKeyFromIndex,
  effectiveArm,
  generateSchedule,
  isComplete,
  makeRng,
  startTrial,
  summariseTrial,
} from './nof1';

const T0 = new Date(2026, 8, 14, 9, 0, 0).getTime(); // 2026-09-14 09:00 local
const DAY = 24 * 60 * 60 * 1000;

describe('day arithmetic', () => {
  it('keys days in local time and counts whole days from the start', () => {
    expect(dayKey(T0)).toBe('2026-09-14');
    expect(dayIndex('2026-09-14', T0)).toBe(0);
    expect(dayIndex('2026-09-14', T0 + 23 * 60 * 60 * 1000)).toBe(1); // 08:00 next day
    expect(dayIndex('2026-09-14', T0 - 1 * DAY)).toBe(-1);
    expect(dayKeyFromIndex('2026-09-14', 17)).toBe('2026-10-01');
  });
});

describe('generateSchedule', () => {
  it('gives each arm exactly half the days and alternates within every block', () => {
    const s = generateSchedule(NOF1_TRIAL_DAYS, makeRng(42));
    expect(s).toHaveLength(NOF1_TRIAL_DAYS);
    expect(s.filter((a) => a === 'active')).toHaveLength(NOF1_TRIAL_DAYS / 2);
    for (let i = 0; i < s.length; i += 2) expect(s[i]).not.toBe(s[i + 1]);
  });

  it('is deterministic for a seed and randomised across seeds', () => {
    expect(generateSchedule(28, makeRng(7))).toEqual(generateSchedule(28, makeRng(7)));
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateSchedule(28, makeRng(seed))[0]));
    expect(firsts.size).toBe(2); // both AB and BA blocks occur
  });
});

describe('assignment and completion', () => {
  const trial = startTrial(T0, makeRng(1));

  it('assigns the scheduled arm inside the window and null outside it', () => {
    expect(assignmentFor(trial, T0)).toBe(trial.schedule[0]);
    expect(assignmentFor(trial, T0 + 5 * DAY)).toBe(trial.schedule[5]);
    expect(assignmentFor(trial, T0 - DAY)).toBeNull();
    expect(assignmentFor(trial, T0 + NOF1_TRIAL_DAYS * DAY)).toBeNull();
  });

  it('is complete after the last day or once stopped', () => {
    expect(isComplete(trial, T0 + 3 * DAY)).toBe(false);
    expect(isComplete(trial, T0 + NOF1_TRIAL_DAYS * DAY)).toBe(true);
    expect(isComplete({ ...trial, stoppedAt: T0 + DAY }, T0 + 2 * DAY)).toBe(true);
    expect(assignmentFor({ ...trial, stoppedAt: T0 + DAY }, T0 + 2 * DAY)).toBeNull();
  });
});

describe('summariseTrial', () => {
  function ratedTrial(activeRatings: number[], bypassRatings: number[]): Nof1Trial {
    const trial = startTrial(T0, makeRng(3));
    let a = 0;
    let b = 0;
    trial.schedule.forEach((arm, i) => {
      const day = dayKeyFromIndex(trial.startDay, i);
      if (arm === 'active' && a < activeRatings.length) trial.ratings[day] = activeRatings[a++];
      if (arm === 'bypass' && b < bypassRatings.length) trial.ratings[day] = bypassRatings[b++];
    });
    return trial;
  }
  const fourteen = (v: number) => Array.from({ length: NOF1_MIN_DAYS_PER_ARM }, () => v);

  it('refuses to compare before both arms have the minimum days', () => {
    const s = summariseTrial(ratedTrial([3, 3, 3], [6, 6]));
    expect(s.sufficient).toBe(false);
    expect(s.sentence).toMatch(/Not enough days/);
    expect(s.active.n).toBe(3);
    expect(s.bypass.n).toBe(2);
  });

  it('reports a benefit only when softening days are ≥ 1 point lower', () => {
    const better = summariseTrial(ratedTrial(fourteen(3), fourteen(5)));
    expect(better.sufficient).toBe(true);
    expect(better.difference).toBeCloseTo(-2);
    expect(better.sentence).toMatch(/looks like it helps/);
    expect(better.sentence).toMatch(/not proof/);

    const same = summariseTrial(ratedTrial(fourteen(5), fourteen(5.5)));
    expect(same.sentence).toMatch(/about the same/);

    const worse = summariseTrial(ratedTrial(fourteen(6), fourteen(4)));
    expect(worse.sentence).toMatch(/may not be helping/);
  });

  it('attributes an overridden day to what the user actually did', () => {
    const trial = ratedTrial(fourteen(3), fourteen(5));
    // Find a scheduled "bypass" day and say the user switched protection on.
    const idx = trial.schedule.indexOf('bypass');
    const day = dayKeyFromIndex(trial.startDay, idx);
    trial.overrides.push({ timestamp: T0 + idx * DAY, day, assigned: 'bypass', chosen: 'active' });
    expect(effectiveArm(trial, day)).toBe('active');
    const s = summariseTrial(trial);
    expect(s.active.n).toBe(NOF1_MIN_DAYS_PER_ARM + 1);
    expect(s.bypass.n).toBe(NOF1_MIN_DAYS_PER_ARM - 1);
    expect(s.overrideDays).toBe(1);
    expect(s.sentence).toMatch(/1 day counted as what you actually chose/);
  });
});
