import { useCallback, useEffect, useState } from 'react';
import { TOLERANCE_STEP_INTERVAL_MS } from '../constants/tolerance';
import { getTolerancePlan, saveTolerancePlan } from '../services/TolerancePlanStore';
import { TolerancePlan } from '../types';

/**
 * Owns the single active tolerance-building plan (see constants/tolerance.ts).
 * Never advances a step on its own -- advanceStep must be called from an
 * explicit user tap; this hook only tracks state and timing.
 */
export function useTolerancePlan() {
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

  const dueForStep = plan !== null && Date.now() - plan.lastStepAt >= TOLERANCE_STEP_INTERVAL_MS;

  return { plan, loaded, dueForStep, startPlan, stopPlan, advanceStep };
}
