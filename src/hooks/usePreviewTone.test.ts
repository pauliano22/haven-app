import { act, renderHook } from '@testing-library/react-native';
import { MAX_TONE_LEVEL_DB } from '../constants/safety';
import { usePreviewTone } from './usePreviewTone';

const mockSendPayload = jest.fn();
let mockStatus = 'connected';

jest.mock('../context/BleContext', () => ({
  useBle: () => ({ status: mockStatus, sendPayload: mockSendPayload }),
}));

describe('usePreviewTone', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendPayload.mockClear();
    mockStatus = 'connected';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses to play when not connected', () => {
    mockStatus = 'disconnected';
    const { result } = renderHook(() => usePreviewTone());

    let started = true;
    act(() => {
      started = result.current.play(1000, 55, 1400);
    });

    expect(started).toBe(false);
    expect(mockSendPayload).not.toHaveBeenCalled();
  });

  it('clamps the requested level before sending TONE_START', () => {
    const { result } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, MAX_TONE_LEVEL_DB + 50, 1400);
    });

    expect(mockSendPayload).toHaveBeenCalledWith({
      type: 'TONE_START',
      f0: 1000,
      level_db: MAX_TONE_LEVEL_DB,
    });
    expect(result.current.playing).toBe(true);
  });

  it('auto-stops after the requested duration and calls onDone', () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, 55, 1400, onDone);
    });
    expect(result.current.playing).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1400);
    });

    expect(result.current.playing).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockSendPayload).toHaveBeenLastCalledWith({ type: 'TONE_STOP' });
  });

  it('interrupts an in-progress burst when play is called again', () => {
    const firstOnDone = jest.fn();
    const { result } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, 55, 1400, firstOnDone);
    });
    act(() => {
      result.current.play(2000, 60, 1400);
    });

    // The first burst's timer must not fire its onDone after being superseded.
    act(() => {
      jest.advanceTimersByTime(1400);
    });
    expect(firstOnDone).not.toHaveBeenCalled();
  });

  it('stops the tone on unmount', () => {
    const { result, unmount } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, 55, 1400);
    });
    mockSendPayload.mockClear();

    unmount();

    expect(mockSendPayload).toHaveBeenCalledWith({ type: 'TONE_STOP' });
  });

  it('stops the tone immediately when the link drops mid-burst', () => {
    const { result, rerender } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, 55, 1400);
    });
    expect(result.current.playing).toBe(true);

    mockStatus = 'disconnected';
    act(() => {
      rerender(undefined);
    });

    expect(result.current.playing).toBe(false);
    expect(mockSendPayload).toHaveBeenLastCalledWith({ type: 'TONE_STOP' });
  });
});
