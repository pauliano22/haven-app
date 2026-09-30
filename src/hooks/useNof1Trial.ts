import { useCallback, useEffect, useMemo, useState } from 'react';
import { logExposure } from '../services/ExposureLog';
import { getTrial, saveTrial } from '../services/TrialStore';
import { Nof1Trial, TrialArm } from '../types';
import {
  assignmentFor,
  dayIndex,
  dayKey,
  isComplete,
  startTrial as buildTrial,
  summariseTrial,
} from '../utils/nof1';

/**
 * Owns the single opt-in N-of-1 trial (utils/nof1.ts). Pure schedule logic
 * lives in the util; this hook only loads/persists and exposes today's
 * assignment. It never changes the device by itself — Home decides whether
 * to honour the assignment and always lets the user override (recorded via
 * `recordOverride`, never blocked).
 */
export function useNof1Trial(now: () => number = Date.now) {
  const [trial, setTrial] = useState<Nof1Trial | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTrial().then((t) => {
      setTrial(t);
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: Nof1Trial | null) => {
    setTrial(next);
    saveTrial(next);
  }, []);

  const startTrial = useCallback(() => {
    const t = buildTrial(now());
    persist(t);
    logExposure('trial_rating', { event: 'start', startDay: t.startDay });
  }, [persist, now]);

  const stopTrial = useCallback(() => {
    if (!trial) return;
    persist({ ...trial, stoppedAt: now() });
  }, [trial, persist, now]);

  /** Clear a finished/stopped trial so a new one can begin; history is kept in the export until then. */
  const clearTrial = useCallback(() => persist(null), [persist]);

  const rateToday = useCallback(
    (bother: number) => {
      if (!trial) return;
      const day = dayKey(now());
      const next = { ...trial, ratings: { ...trial.ratings, [day]: bother } };
      persist(next);
      logExposure('trial_rating', { day, bother, arm: assignmentFor(trial, now()) });
    },
    [trial, persist, now],
  );

  const recordOverride = useCallback(
    (chosen: TrialArm) => {
      if (!trial) return;
      const ts = now();
      const assigned = assignmentFor(trial, ts);
      if (!assigned || assigned === chosen) return;
      const day = dayKey(ts);
      const next = { ...trial, overrides: [...trial.overrides, { timestamp: ts, day, assigned, chosen }] };
      persist(next);
      logExposure('trial_override', { day, assigned, chosen });
    },
    [trial, persist, now],
  );

  const ts = now();
  const todayKey = dayKey(ts);
  const active = trial !== null && !isComplete(trial, ts);
  const todayAssignment: TrialArm | null = trial ? assignmentFor(trial, ts) : null;
  const todayOverride = trial?.overrides.find((o) => o.day === todayKey) ?? null;
  const todayRated = trial ? trial.ratings[todayKey] !== undefined : false;
  const dayNumber = trial ? dayIndex(trial.startDay, ts) + 1 : 0;
  const complete = trial !== null && isComplete(trial, ts);
  const summary = useMemo(() => (trial ? summariseTrial(trial) : null), [trial]);

  return {
    trial,
    loaded,
    active,
    complete,
    dayNumber,
    totalDays: trial?.schedule.length ?? 0,
    todayAssignment,
    todayOverride,
    todayRated,
    summary,
    startTrial,
    stopTrial,
    clearTrial,
    rateToday,
    recordOverride,
  };
}
