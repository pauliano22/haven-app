import { useCallback, useEffect, useState } from 'react';
import { TOLERANCE_STEP_INTERVAL_MS } from '../constants/tolerance';
import { ComfortResponse } from '../services/ComfortHistoryStore';
import { getTolerancePlan, saveTolerancePlan } from '../services/TolerancePlanStore';
import { TolerancePlan } from '../types';
import { computeNextIntervalMs } from '../utils/tolerancePacing';

/**
 * Owns the single active tolerance-building plan (see constants/tolerance.ts).
 * Never advances a step on its own -- advanceStep must be called from an
 * explicit user tap; this hook only tracks state and timing.
 *
 * `recentComfortResponses` (from useComfortPrompt, same screen) adapts how
 * long the wait is before the next step becomes available to tap -- see
 * utils/tolerancePacing.ts for the heuristic and why it's a plain rule, not
 * a bandit. Only responses at or after the plan's last step count; earlier
 * ones (from before this step started, or from a previous plan) don't
 * influence pacing that no longer applies. Passing nothing (the default)
 * keeps the original fixed-interval behavior exactly.
 */
export function useTolerancePlan(recentComfortResponses: readonly ComfortResponse[] = []) {
  const [plan, setPlan] = useState<TolerancePlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTolerancePlan().then((p) => {
      setPlan(p);
      setLoaded(true);
    });
  }, []);

  const startPlan = useCallback((bandId: string, f0: number) => {
    const now = Date.now();
    const next: TolerancePlan = { bandId, f0, startedAt: now, lastStepAt: now, stepsCompleted: 0 };
    setPlan(next);
    saveTolerancePlan(next);
  }, []);

  const stopPlan = useCallback(() => {
    setPlan(null);
    saveTolerancePlan(null);
  }, []);

  const advanceStep = useCallback(() => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next: TolerancePlan = {
        ...prev,
        lastStepAt: Date.now(),
        stepsCompleted: prev.stepsCompleted + 1,
      };
      saveTolerancePlan(next);
      return next;
    });
  }, []);

  let intervalMs = TOLERANCE_STEP_INTERVAL_MS;
  if (plan) {
    const directionsSinceLastStep = recentComfortResponses
      .filter((r) => r.timestamp >= plan.lastStepAt)
      .sort((a, b) => a.timestamp - b.timestamp) // oldest first, as computeNextIntervalMs expects
      .map((r) => r.direction);
    intervalMs = computeNextIntervalMs(TOLERANCE_STEP_INTERVAL_MS, directionsSinceLastStep);
  }

  const dueForStep = plan !== null && Date.now() - plan.lastStepAt >= intervalMs;

  return { plan, loaded, dueForStep, intervalMs, startPlan, stopPlan, advanceStep };
}
