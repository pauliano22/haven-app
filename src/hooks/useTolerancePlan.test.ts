import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { TOLERANCE_STEP_INTERVAL_MS } from '../constants/tolerance';
import { useTolerancePlan } from './useTolerancePlan';

const flushLoad = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useTolerancePlan', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has no plan by default', async () => {
    const { result } = renderHook(() => useTolerancePlan());
    await flushLoad();
    expect(result.current.plan).toBeNull();
    expect(result.current.dueForStep).toBe(false);
  });

  it('starts a plan for the given band, not due immediately', async () => {
    const { result } = renderHook(() => useTolerancePlan());
    await flushLoad();

    act(() => {
      result.current.startPlan('band-1', 3200);
    });

    expect(result.current.plan).toMatchObject({ bandId: 'band-1', f0: 3200, stepsCompleted: 0 });
    expect(result.current.dueForStep).toBe(false);
  });

  it('persists the plan across a remount', async () => {
    const { result, unmount } = renderHook(() => useTolerancePlan());
    await flushLoad();
    act(() => {
      result.current.startPlan('band-1', 3200);
    });
    unmount();

    const second = renderHook(() => useTolerancePlan());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(second.result.current.plan).toMatchObject({ bandId: 'band-1', f0: 3200 });
  });

  it('becomes due once the step interval has elapsed', async () => {
    await AsyncStorage.setItem(
      'haven.tolerancePlan.v1',
      JSON.stringify({
        bandId: 'band-1',
        f0: 3200,
        startedAt: Date.now() - TOLERANCE_STEP_INTERVAL_MS - 1000,
        lastStepAt: Date.now() - TOLERANCE_STEP_INTERVAL_MS - 1000,
        stepsCompleted: 0,
      }),
    );

    const { result } = renderHook(() => useTolerancePlan());
    await flushLoad();

    expect(result.current.dueForStep).toBe(true);
  });

  it('advancing a step resets the due timer and increments the count', async () => {
    const { result } = renderHook(() => useTolerancePlan());
    await flushLoad();
    act(() => {
      result.current.startPlan('band-1', 3200);
    });

    // Force it into the "due" state directly via the store, then reload via advanceStep's own logic.
    act(() => {
      result.current.advanceStep();
    });

    expect(result.current.plan?.stepsCompleted).toBe(1);
    expect(result.current.dueForStep).toBe(false);
  });

  it('stopping the plan clears it and persists the clear', async () => {
    const { result } = renderHook(() => useTolerancePlan());
    await flushLoad();
    act(() => {
      result.current.startPlan('band-1', 3200);
    });
    act(() => {
      result.current.stopPlan();
    });

    expect(result.current.plan).toBeNull();
    expect(await AsyncStorage.getItem('haven.tolerancePlan.v1')).toBeNull();
  });

  describe('adaptive pacing from recent comfort responses', () => {
    const lastStepAt = Date.now() - TOLERANCE_STEP_INTERVAL_MS / 2; // halfway through the normal wait

    async function seedPlan() {
      await AsyncStorage.setItem(
        'haven.tolerancePlan.v1',
        JSON.stringify({ bandId: 'band-1', f0: 3200, startedAt: lastStepAt, lastStepAt, stepsCompleted: 0 }),
      );
    }

    it('two comfortable responses since the last step make it due early', async () => {
      await seedPlan();
      const responses = [
        { timestamp: lastStepAt + 1000, direction: 'same' as const },
        { timestamp: lastStepAt + 2000, direction: 'same' as const },
      ];

      const { result } = renderHook(() => useTolerancePlan(responses));
      await flushLoad();

      // Halved interval means "due" at TOLERANCE_STEP_INTERVAL_MS / 4 after
      // lastStepAt -- we're already at /2, well past that.
      expect(result.current.dueForStep).toBe(true);
    });

    it('two "not enough, soften it more" responses since the last step delay it past the normal wait', async () => {
      await seedPlan();
      const responses = [
        { timestamp: lastStepAt + 1000, direction: 'stronger' as const },
        { timestamp: lastStepAt + 2000, direction: 'stronger' as const },
      ];

      const { result } = renderHook(() => useTolerancePlan(responses));
      await flushLoad();

      // Doubled interval means not due until 2x the normal wait -- we're
      // only at /2, nowhere close.
      expect(result.current.dueForStep).toBe(false);
    });

    it('ignores comfort responses from before the plan last stepped', async () => {
      await seedPlan();
      const staleResponses = [
        { timestamp: lastStepAt - 1000, direction: 'same' as const },
        { timestamp: lastStepAt - 2000, direction: 'same' as const },
      ];

      const { result } = renderHook(() => useTolerancePlan(staleResponses));
      await flushLoad();

      // No responses actually count (both before lastStepAt) -- falls back
      // to the unmodified base interval, so still not due at the halfway
      // point.
      expect(result.current.dueForStep).toBe(false);
    });

    it('defaults to the original fixed-interval behavior when called with no comfort history at all', async () => {
      await seedPlan();
      const { result } = renderHook(() => useTolerancePlan());
      await flushLoad();
      expect(result.current.dueForStep).toBe(false); // unmodified interval, only halfway through
    });
  });
});
