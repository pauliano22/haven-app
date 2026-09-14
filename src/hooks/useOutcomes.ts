import { useCallback, useEffect, useState } from 'react';
import { THI_INTERVAL_MS, VAS_INTERVAL_MS } from '../constants/outcomes';
import { logExposure } from '../services/ExposureLog';
import { getThiRuns, getVasCheckIns, saveThiRun, saveVasCheckIn } from '../services/OutcomeStore';
import { ThiAnswer, ThiRun, VasCheckIn } from '../types';
import { scoreThi } from '../utils/thi';

/** Due when never done, or when `interval` has passed since the newest entry. */
export function isDue(newestTimestamp: number | undefined, intervalMs: number, now: number): boolean {
  return newestTimestamp === undefined || now - newestTimestamp >= intervalMs;
}

/**
 * Loads both outcome instruments' histories (newest first) and says which
 * is due: the VAS pair weekly, the THI at first use and then monthly.
 */
export function useOutcomes(now: () => number = Date.now) {
  const [vas, setVas] = useState<VasCheckIn[]>([]);
  const [thi, setThi] = useState<ThiRun[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getVasCheckIns(), getThiRuns()]).then(([v, t]) => {
      setVas(v);
      setThi(t);
      setLoaded(true);
    });
  }, []);

  const recordVas = useCallback(
    (loudness: number, bother: number) => {
      const entry: VasCheckIn = { timestamp: now(), loudness, bother };
      setVas((prev) => [entry, ...prev]);
      saveVasCheckIn(entry);
      logExposure('vas', { loudness, bother });
    },
    [now],
  );

  const recordThi = useCallback(
    (answers: ThiAnswer[]) => {
      const run: ThiRun = { timestamp: now(), answers, total: scoreThi(answers) };
      setThi((prev) => [run, ...prev]);
      saveThiRun(run);
      logExposure('thi', { total: run.total });
      return run;
    },
    [now],
  );

  const t = now();
  return {
    vas,
    thi,
    loaded,
    vasDue: loaded && isDue(vas[0]?.timestamp, VAS_INTERVAL_MS, t),
    thiDue: loaded && isDue(thi[0]?.timestamp, THI_INTERVAL_MS, t),
    recordVas,
    recordThi,
  };
}
