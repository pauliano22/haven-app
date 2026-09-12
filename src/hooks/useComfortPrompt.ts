import { useCallback, useEffect, useState } from 'react';
import { COMFORT_PROMPT_MIN_INTERVAL_MS } from '../constants/comfort';
import { getLastPromptedAt, setLastPromptedAt } from '../services/ComfortStore';

/**
 * Decides whether to show the comfort check-in: only while `active` (the
 * caller passes connected && !bypass — kept decoupled from BLE/filter
 * contexts here for testability) and only once per
 * COMFORT_PROMPT_MIN_INTERVAL_MS since the last time the user responded.
 */
export function useComfortPrompt(active: boolean) {
  const [lastPromptedAt, setLastPromptedAtState] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getLastPromptedAt().then((value) => {
      setLastPromptedAtState(value);
      setLoaded(true);
    });
  }, []);

  const dueForPrompt =
    lastPromptedAt === null || Date.now() - lastPromptedAt >= COMFORT_PROMPT_MIN_INTERVAL_MS;

  const shouldPrompt = active && loaded && dueForPrompt;

  const recordResponse = useCallback(() => {
    const now = Date.now();
    setLastPromptedAtState(now);
    setLastPromptedAt(now);
  }, []);

  return { shouldPrompt, recordResponse };
}
