import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { NOF1_TRIAL_DAYS } from '../constants/outcomes';
import { useNof1Trial } from './useNof1Trial';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 8, 14, 9, 0, 0).getTime();

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useNof1Trial', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has no trial by default and starts one on request', async () => {
    let now = T0;
    const { result } = renderHook(() => useNof1Trial(() => now));
    await flush();
    expect(result.current.trial).toBeNull();
    expect(result.current.active).toBe(false);

    act(() => result.current.startTrial());
    expect(result.current.active).toBe(true);
    expect(result.current.dayNumber).toBe(1);
    expect(result.current.totalDays).toBe(NOF1_TRIAL_DAYS);
    expect(['active', 'bypass']).toContain(result.current.todayAssignment);
  });

  it('records a daily rating once and persists across remount', async () => {
    const now = T0;
    const first = renderHook(() => useNof1Trial(() => now));
    await flush();
    act(() => first.result.current.startTrial());
    act(() => first.result.current.rateToday(4));
    expect(first.result.current.todayRated).toBe(true);
    first.unmount();

    const second = renderHook(() => useNof1Trial(() => now));
    await flush();
    expect(second.result.current.trial?.ratings['2026-09-14']).toBe(4);
  });

  it('records an override only when it differs from the assignment', async () => {
    const now = T0;
    const { result } = renderHook(() => useNof1Trial(() => now));
    await flush();
    act(() => result.current.startTrial());
    const assigned = result.current.todayAssignment!;
    act(() => result.current.recordOverride(assigned));
    expect(result.current.trial?.overrides).toHaveLength(0);
    const other = assigned === 'active' ? 'bypass' : 'active';
    act(() => result.current.recordOverride(other));
    expect(result.current.trial?.overrides).toHaveLength(1);
    expect(result.current.todayOverride?.chosen).toBe(other);
  });

  it('is complete after the last day, and stop ends it early', async () => {
    let now = T0;
    const { result, rerender } = renderHook(() => useNof1Trial(() => now));
    await flush();
    act(() => result.current.startTrial());
    now = T0 + NOF1_TRIAL_DAYS * DAY;
    rerender({});
    expect(result.current.complete).toBe(true);
    expect(result.current.todayAssignment).toBeNull();

    act(() => result.current.clearTrial());
    expect(result.current.trial).toBeNull();
    now = T0;
    act(() => result.current.startTrial());
    act(() => result.current.stopTrial());
    expect(result.current.complete).toBe(true);
  });
});
