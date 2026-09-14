import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { THI_INTERVAL_MS, VAS_INTERVAL_MS } from '../constants/outcomes';
import { ThiAnswer } from '../types';
import { isDue, useOutcomes } from './useOutcomes';

const T0 = 1_800_000_000_000;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('isDue', () => {
  it('is due when never done or when the interval has elapsed', () => {
    expect(isDue(undefined, VAS_INTERVAL_MS, T0)).toBe(true);
    expect(isDue(T0 - VAS_INTERVAL_MS, VAS_INTERVAL_MS, T0)).toBe(true);
    expect(isDue(T0 - VAS_INTERVAL_MS + 1, VAS_INTERVAL_MS, T0)).toBe(false);
  });
});

describe('useOutcomes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with both instruments due, then not due after recording', async () => {
    let now = T0;
    const { result, rerender } = renderHook(() => useOutcomes(() => now));
    await flush();
    expect(result.current.vasDue).toBe(true);
    expect(result.current.thiDue).toBe(true);

    act(() => result.current.recordVas(5, 3));
    expect(result.current.vasDue).toBe(false);
    expect(result.current.vas[0]).toMatchObject({ loudness: 5, bother: 3 });

    const answers: ThiAnswer[] = Array(25).fill('sometimes');
    act(() => {
      result.current.recordThi(answers);
    });
    expect(result.current.thiDue).toBe(false);
    expect(result.current.thi[0].total).toBe(50);

    now = T0 + VAS_INTERVAL_MS;
    rerender({});
    expect(result.current.vasDue).toBe(true);
    expect(result.current.thiDue).toBe(false);
    now = T0 + THI_INTERVAL_MS;
    rerender({});
    expect(result.current.thiDue).toBe(true);
  });

  it('persists to storage', async () => {
    const { result } = renderHook(() => useOutcomes(() => T0));
    await flush();
    act(() => result.current.recordVas(2, 1));
    await flush(); // the store's read-then-write is async
    const raw = await AsyncStorage.getItem('haven.outcomes.vas.v1');
    expect(JSON.parse(raw!)[0]).toMatchObject({ loudness: 2, bother: 1, timestamp: T0 });
  });
});
