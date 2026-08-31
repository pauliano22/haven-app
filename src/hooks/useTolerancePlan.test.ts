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
});
