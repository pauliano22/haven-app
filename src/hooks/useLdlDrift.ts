import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLdlHistory } from '../services/LdlHistoryStore';
import { FilterBand, LdlRun } from '../types';
import { findLdlDrift, LdlDriftWarning } from '../utils/ldlDrift';

/**
 * Loads the comfort-test history once and evaluates the over-protection
 * signal (utils/ldlDrift.ts) against the current bands. Dismissals are
 * per-band and per-session only: a warning that is real should come back
 * next time the screen opens, and it disappears for good once the band is
 * paused or removed (findLdlDrift skips bands with no softening).
 */
export function useLdlDrift(bands: FilterBand[]) {
  const [history, setHistory] = useState<LdlRun[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    getLdlHistory().then(setHistory);
  }, []);

  const warnings = useMemo(
    () => findLdlDrift(history, bands).filter((w) => !dismissed.has(w.bandId)),
    [history, bands, dismissed],
  );

  const dismiss = useCallback((bandId: string) => {
    setDismissed((prev) => new Set(prev).add(bandId));
  }, []);

  return { warnings, dismiss };
}
