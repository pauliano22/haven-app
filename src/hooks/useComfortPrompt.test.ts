import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { COMFORT_PROMPT_MIN_INTERVAL_MS } from '../constants/comfort';
import { useComfortPrompt } from './useComfortPrompt';

/** Lets the hook's startup AsyncStorage read (a real microtask chain) settle. */
const flushLoad = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useComfortPrompt', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('never prompts while inactive, even with nothing stored', async () => {
    const { result } = renderHook(() => useComfortPrompt(false));
    await flushLoad();
    expect(result.current.shouldPrompt).toBe(false);
  });

  it('prompts once active if nothing has ever been recorded', async () => {
    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();
    expect(result.current.shouldPrompt).toBe(true);
  });

  it('stops prompting immediately after a response is recorded', async () => {
    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();
    expect(result.current.shouldPrompt).toBe(true);

    act(() => {
      result.current.recordResponse('same');
    });

    expect(result.current.shouldPrompt).toBe(false);
  });

  it('does not prompt again before the minimum interval has passed', async () => {
    const recent = Date.now() - 1000;
    await AsyncStorage.setItem('haven.comfortPrompt.v1', String(recent));

    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();

    expect(result.current.shouldPrompt).toBe(false);
  });

  it('prompts again once the minimum interval has elapsed', async () => {
    const longAgo = Date.now() - COMFORT_PROMPT_MIN_INTERVAL_MS - 1000;
    await AsyncStorage.setItem('haven.comfortPrompt.v1', String(longAgo));

    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();

    expect(result.current.shouldPrompt).toBe(true);
  });

  it('starts with empty history when nothing has been recorded', async () => {
    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();
    expect(result.current.history).toEqual([]);
  });

  it('recordResponse appends to history, most recent first', async () => {
    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();

    act(() => result.current.recordResponse('weaker'));
    act(() => result.current.recordResponse('same'));

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].direction).toBe('same'); // most recent first
    expect(result.current.history[1].direction).toBe('weaker');
  });

  it('loads previously persisted history on mount', async () => {
    const past = [{ timestamp: Date.now() - 1000, direction: 'stronger' as const }];
    await AsyncStorage.setItem('haven.comfortHistory.v1', JSON.stringify(past));

    const { result } = renderHook(() => useComfortPrompt(true));
    await flushLoad();

    expect(result.current.history).toEqual(past);
  });
});
