import { act, renderHook } from '@testing-library/react-native';
import {
  LDL_MAX_TONE_DURATION_MS,
  LDL_RAMP_INTERVAL_MS,
  LDL_START_LEVEL_DB,
  MAX_TONE_LEVEL_DB,
} from '../constants/safety';
import { ToneStopInfo, useLdlTone } from './useLdlTone';

import { DeviceBootInfo, DeviceMessage } from '../types';

const mockSendPayload = jest.fn();
let mockStatus = 'connected';
let mockDeviceInfo: DeviceBootInfo | null = null;
/** Listeners the hook registered via onDeviceMessage; tests push device lines through them. */
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

describe('useLdlTone', () => {
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

  it('refuses to start against a build whose boot event names a DAC path without the limiter', () => {
    mockDeviceInfo = { fw: '0.1.0-dev', fdspRate: 192000, dacSource: 'dmic_direct' };
    const { result } = renderHook(() => useLdlTone());

    let started = true;
    act(() => {
      started = result.current.start(1000, () => {});
    });

    expect(started).toBe(false);
    expect(mockSendPayload).not.toHaveBeenCalled();
  });

  it('still starts on the product path (dac_source fdsp)', () => {
    mockDeviceInfo = { fw: '0.1.0-dev', fdspRate: 192000, dacSource: 'fdsp' };
    const { result } = renderHook(() => useLdlTone());

    let started = false;
    act(() => {
      started = result.current.start(1000, () => {});
    });

    expect(started).toBe(true);
  });

  it('treats a device tone_watchdog event as an external stop: idle, aborted, no result, no TONE_STOP', () => {
    const onAutoStop = jest.fn();
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(2000, onAutoStop);
    });
    act(() => {
      jest.advanceTimersByTime(LDL_RAMP_INTERVAL_MS * 2);
    });
    const sendsBefore = mockSendPayload.mock.calls.length;

    act(() => {
      deviceSays({ kind: 'event', event: 'tone_watchdog' });
    });

    expect(result.current.toneState).toBe('idle');
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(onAutoStop.mock.calls[0][0]).toMatchObject({ aborted: true, cappedOut: false });
    // The device is already silent -- we do not send a redundant TONE_STOP.
    expect(mockSendPayload.mock.calls.length).toBe(sendsBefore);

    // And the ramp really is dead: no further TONE_LEVELs.
    act(() => {
      jest.advanceTimersByTime(LDL_RAMP_INTERVAL_MS * 5);
    });
    expect(mockSendPayload.mock.calls.length).toBe(sendsBefore);
  });

  it('ignores a tone_watchdog event while idle', () => {
    const onAutoStop = jest.fn();
    renderHook(() => useLdlTone());

    act(() => {
      deviceSays({ kind: 'event', event: 'tone_watchdog' });
    });

    expect(onAutoStop).not.toHaveBeenCalled();
    expect(mockSendPayload).not.toHaveBeenCalled();
  });

  it('shows the level the device says it applied when an ack echoes a clamped value', () => {
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    expect(result.current.levelDb).toBe(LDL_START_LEVEL_DB);

    // A (hypothetical) firmware with a lower ceiling clamps our 30 to 24.
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'TONE_START', ok: true, f0: 1000, levelDb: 24 });
    });
    expect(result.current.levelDb).toBe(24);

    // The next ramp step continues from the applied value, not the requested one.
    act(() => {
      jest.advanceTimersByTime(LDL_RAMP_INTERVAL_MS);
    });
    expect(mockSendPayload).toHaveBeenLastCalledWith({ type: 'TONE_LEVEL', level_db: 24 + 2 });
  });

  it('an echoed level can never raise the meter above the app ceiling', () => {
    const { result } = renderHook(() => useLdlTone());

    act(() => {
      result.current.start(1000, () => {});
    });
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'TONE_LEVEL', ok: true, levelDb: MAX_TONE_LEVEL_DB + 40 });
    });

    expect(result.current.levelDb).toBeLessThanOrEqual(MAX_TONE_LEVEL_DB);
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
