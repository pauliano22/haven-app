import { useCallback, useEffect, useState } from 'react';
import { ComfortDirection } from '../components/ComfortCheckIn';
import { COMFORT_PROMPT_MIN_INTERVAL_MS } from '../constants/comfort';
import { getComfortHistory, saveComfortResponse, ComfortResponse } from '../services/ComfortHistoryStore';
import { getLastPromptedAt, setLastPromptedAt } from '../services/ComfortStore';

/**
 * Decides whether to show the comfort check-in: only while `active` (the
 * caller passes connected && !bypass — kept decoupled from BLE/filter
 * contexts here for testability) and only once per
 * COMFORT_PROMPT_MIN_INTERVAL_MS since the last time the user responded.
 *
 * Also owns the response history (`history`) used by the tolerance-plan
 * pacing heuristic (see utils/tolerancePacing.ts) — kept here rather than
 * split into a second hook, since this is the one place a response is ever
 * recorded.
 */
export function useComfortPrompt(active: boolean) {
  const [lastPromptedAt, setLastPromptedAtState] = useState<number | null>(null);
  const [history, setHistory] = useState<ComfortResponse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getLastPromptedAt(), getComfortHistory()]).then(([prompted, storedHistory]) => {
      setLastPromptedAtState(prompted);
      setHistory(storedHistory);
      setLoaded(true);
    });
  }, []);

  const dueForPrompt =
    lastPromptedAt === null || Date.now() - lastPromptedAt >= COMFORT_PROMPT_MIN_INTERVAL_MS;

  const shouldPrompt = active && loaded && dueForPrompt;

  const recordResponse = useCallback((direction: ComfortDirection) => {
    const now = Date.now();
    setLastPromptedAtState(now);
    setLastPromptedAt(now);

    const response: ComfortResponse = { timestamp: now, direction };
    setHistory((prev) => [response, ...prev]);
    saveComfortResponse(response);
  }, []);

  return { shouldPrompt, history, recordResponse };
}
