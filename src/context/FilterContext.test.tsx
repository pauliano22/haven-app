import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DeviceMessage } from '../types';
import { FilterProvider, useFilters } from './FilterContext';

const mockSendPayload = jest.fn();
let mockStatus = 'connected';
const mockDeviceListeners = new Set<(m: DeviceMessage) => void>();
function deviceSays(message: DeviceMessage) {
  mockDeviceListeners.forEach((l) => l(message));
}

jest.mock('./BleContext', () => ({
  useBle: () => ({
    status: mockStatus,
    sendPayload: mockSendPayload,
    deviceInfo: null,
    lastMessage: null,
    onDeviceMessage: (listener: (m: DeviceMessage) => void) => {
      mockDeviceListeners.add(listener);
      return { remove: () => mockDeviceListeners.delete(listener) };
    },
  }),
}));

// The exposure log is consent-gated and async; it is not what's under test.
jest.mock('../services/ExposureLog', () => ({ logExposure: jest.fn() }));

function wrapper({ children }: { children: React.ReactNode }) {
  return <FilterProvider>{children}</FilterProvider>;
}

/** Renders the provider and waits for the (empty) saved profile to hydrate
 * and the once-per-connection sync to go out. */
async function renderFilters() {
  const hook = renderHook(() => useFilters(), { wrapper });
  await waitFor(() => expect(mockSendPayload).toHaveBeenCalled());
  return hook;
}

describe('FilterContext — device ack handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendPayload.mockClear();
    mockStatus = 'connected';
    mockDeviceListeners.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an optimistic edit when the device acks it ok', async () => {
    const { result } = await renderFilters();
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 1 }); // confirms the sync
    });
    const before = result.current.bands[0];

    act(() => {
      result.current.updateSelected({ f0: 6000 });
      jest.advanceTimersByTime(150); // debounced send
    });
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 1 });
    });

    expect(result.current.bands[0].f0).toBe(6000);
    expect(result.current.bands[0].f0).not.toBe(before.f0);
    expect(result.current.lastRejectedAt).toBeNull();
  });

  it('rolls the bands back to the last confirmed state when the device refuses the change', async () => {
    const { result } = await renderFilters();
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 1 });
    });
    const confirmedF0 = result.current.bands[0].f0;

    act(() => {
      result.current.updateSelected({ f0: 6000 });
      jest.advanceTimersByTime(150);
    });
    expect(result.current.bands[0].f0).toBe(6000); // optimistic

    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: false, err: 'dsp', code: -5 });
    });

    expect(result.current.bands[0].f0).toBe(confirmedF0);
    expect(result.current.lastRejectedAt).not.toBeNull();
  });

  it('rolls bypass back too, and does not re-send (no retry loop)', async () => {
    const { result } = await renderFilters();
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 1 });
    });
    const sendsBefore = mockSendPayload.mock.calls.length;

    act(() => {
      result.current.setBypass(true);
    });
    expect(result.current.bypass).toBe(true);
    expect(mockSendPayload.mock.calls.length).toBe(sendsBefore + 1);

    act(() => {
      deviceSays({ kind: 'ack', cmd: 'BYPASS', ok: false, err: 'dsp', code: -5 });
    });

    expect(result.current.bypass).toBe(false);
    expect(mockSendPayload.mock.calls.length).toBe(sendsBefore + 1);
  });

  it('ignores tone acks and a parse-error ack for a line it never sent as a filter change', async () => {
    const { result } = await renderFilters();
    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 1 });
      result.current.updateSelected({ f0: 6000 });
      jest.advanceTimersByTime(150);
    });

    act(() => {
      deviceSays({ kind: 'ack', cmd: 'TONE_LEVEL', ok: true, levelDb: 40 });
      deviceSays({ kind: 'ack', cmd: '?', ok: false, err: 'parse' });
    });

    expect(result.current.bands[0].f0).toBe(6000);
    expect(result.current.lastRejectedAt).toBeNull();
  });

  it('with nothing confirmed yet, a refusal only flags the rejection (nothing to roll back to)', async () => {
    const { result } = await renderFilters();
    const f0 = result.current.bands[0].f0;

    act(() => {
      deviceSays({ kind: 'ack', cmd: 'MULTI_FILTER', ok: false, err: 'dsp', code: -5 });
    });

    expect(result.current.bands[0].f0).toBe(f0);
    expect(result.current.lastRejectedAt).not.toBeNull();
  });
});
