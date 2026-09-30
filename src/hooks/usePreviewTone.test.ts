import { act, renderHook } from '@testing-library/react-native';
import { MAX_TONE_LEVEL_DB } from '../constants/safety';
import { usePreviewTone } from './usePreviewTone';

import { DeviceBootInfo, DeviceMessage } from '../types';

const mockSendPayload = jest.fn();
let mockStatus = 'connected';
let mockDeviceInfo: DeviceBootInfo | null = null;
const mockDeviceListeners = new Set<(m: DeviceMessage) => void>();
function deviceSays(message: DeviceMessage) {
  mockDeviceListeners.forEach((l) => l(message));
}

jest.mock('../context/BleContext', () => ({
  useBle: () => ({
    status: mockStatus,
    sendPayload: mockSendPayload,
    deviceInfo: mockDeviceInfo,
    onDeviceMessage: (listener: (m: DeviceMessage) => void) => {
      mockDeviceListeners.add(listener);
      return { remove: () => mockDeviceListeners.delete(listener) };
    },
  }),
}));

describe('usePreviewTone', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendPayload.mockClear();
    mockStatus = 'connected';
    mockDeviceInfo = null;
    mockDeviceListeners.clear();
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

  it('refuses to play against a no-limiter build (boot event dac_source dmic_direct)', () => {
    mockDeviceInfo = { fw: '0.1.0-dev', fdspRate: 192000, dacSource: 'dmic_direct' };
    const { result } = renderHook(() => usePreviewTone());

    let started = true;
    act(() => {
      started = result.current.play(1000, 55, 1400);
    });

    expect(started).toBe(false);
    expect(mockSendPayload).not.toHaveBeenCalled();
  });

  it('a device tone_watchdog event ends the burst on our side without a redundant TONE_STOP', () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => usePreviewTone());

    act(() => {
      result.current.play(1000, 55, 1400, onDone);
    });
    expect(result.current.playing).toBe(true);
    mockSendPayload.mockClear();

    act(() => {
      deviceSays({ kind: 'event', event: 'tone_watchdog' });
    });

    expect(result.current.playing).toBe(false);
    expect(mockSendPayload).not.toHaveBeenCalled();

    // The burst timer was cancelled too: no TONE_STOP later, no onDone.
    act(() => {
      jest.advanceTimersByTime(1400);
    });
    expect(mockSendPayload).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
