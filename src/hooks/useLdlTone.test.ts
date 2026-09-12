import { act, renderHook } from '@testing-library/react-native';
import {
  LDL_MAX_TONE_DURATION_MS,
  LDL_RAMP_INTERVAL_MS,
  LDL_START_LEVEL_DB,
  MAX_TONE_LEVEL_DB,
} from '../constants/safety';
import { ToneStopInfo, useLdlTone } from './useLdlTone';

const mockSendPayload = jest.fn();
let mockStatus = 'connected';

jest.mock('../context/BleContext', () => ({
  useBle: () => ({ status: mockStatus, sendPayload: mockSendPayload }),
}));

describe('useLdlTone', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendPayload.mockClear();
    mockStatus = 'connected';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses to start when not connected, so a stale start can never replay offline', () => {
    mockStatus = 'disconnected';
    const { result } = renderHook(() => useLdlTone());

    let started = true;
    act(() => {
      started = result.current.start(1000, () => {});
    });

    expect(started).toBe(false);
    expect(mockSendPayload).not.toHaveBeenCalled();
  });

  it('starts at the safe starting level and ramps upward over time', () => {
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    expect(mockSendPayload).toHaveBeenCalledWith({
      type: 'TONE_START',
      f0: 1000,
      level_db: LDL_START_LEVEL_DB,
    });
    expect(result.current.toneState).toBe('ramping');

    act(() => {
      jest.advanceTimersByTime(LDL_RAMP_INTERVAL_MS);
    });
    expect(result.current.levelDb).toBeGreaterThan(LDL_START_LEVEL_DB);
  });

  it('reports the level at the moment of a user-initiated stop', () => {
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    act(() => {
      jest.advanceTimersByTime(LDL_RAMP_INTERVAL_MS * 3);
    });

    let info: ToneStopInfo | undefined;
    act(() => {
      info = result.current.stop();
    });

    expect(info?.cappedOut).toBe(false);
    expect(info?.levelDb).toBe(result.current.levelDb);
    expect(mockSendPayload).toHaveBeenLastCalledWith({ type: 'TONE_STOP' });
    expect(result.current.toneState).toBe('idle');
  });

  it('never exceeds MAX_TONE_LEVEL_DB and auto-stops reporting cappedOut', () => {
    const onAutoStop = jest.fn();
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, onAutoStop);
    });

    // Past the ceiling and the hold-then-auto-stop delay.
    act(() => {
      jest.advanceTimersByTime(LDL_MAX_TONE_DURATION_MS);
    });

    expect(result.current.levelDb).toBeLessThanOrEqual(MAX_TONE_LEVEL_DB);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop.mock.calls[0][0]).toEqual({
      levelDb: MAX_TONE_LEVEL_DB,
      cappedOut: true,
    });
    expect(result.current.toneState).toBe('idle');
  });

  it('kills the tone immediately when the link drops mid-test', () => {
    const { result, rerender } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    expect(result.current.toneState).toBe('ramping');

    mockStatus = 'disconnected';
    act(() => {
      rerender(undefined);
    });

    expect(result.current.toneState).toBe('idle');
    expect(mockSendPayload).toHaveBeenLastCalledWith({ type: 'TONE_STOP' });
  });

  it('stops the tone on unmount', () => {
    const { result, unmount } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    mockSendPayload.mockClear();

    unmount();

    expect(mockSendPayload).toHaveBeenCalledWith({ type: 'TONE_STOP' });
  });
});
