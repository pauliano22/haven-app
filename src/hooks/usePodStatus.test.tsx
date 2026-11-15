import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { DeviceMessage } from '../types';
import { PodStatusProvider, usePodStatus } from './usePodStatus';

let mockStatus = 'connected';
const mockListeners = new Set<(m: DeviceMessage) => void>();
function deviceSays(message: DeviceMessage) {
  mockListeners.forEach((l) => l(message));
}

jest.mock('../context/BleContext', () => ({
  useBle: () => ({
    status: mockStatus,
    onDeviceMessage: (listener: (m: DeviceMessage) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  }),
}));

const report: DeviceMessage = {
  kind: 'event',
  event: 'status',
  mv: 3850,
  pct: 57,
  usb: false,
  charging: false,
  fault: false,
  codec: true,
  problem: 'none',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <PodStatusProvider>{children}</PodStatusProvider>;
}

describe('usePodStatus', () => {
  beforeEach(() => {
    mockStatus = 'connected';
    mockListeners.clear();
  });

  it('is null until a report arrives, then holds the latest one', () => {
    const { result } = renderHook(() => usePodStatus(), { wrapper });
    expect(result.current).toBeNull();
    act(() => deviceSays(report));
    expect(result.current).toEqual({
      mv: 3850, pct: 57, usb: false, charging: false, fault: false, codec: true, problem: 'none',
    });
    act(() => deviceSays({ ...report, pct: 40, charging: true } as DeviceMessage));
    expect(result.current?.pct).toBe(40);
    expect(result.current?.charging).toBe(true);
  });

  it('ignores other messages', () => {
    const { result } = renderHook(() => usePodStatus(), { wrapper });
    act(() => deviceSays({ kind: 'event', event: 'tone_watchdog' }));
    expect(result.current).toBeNull();
  });

  it('clears when the pod disconnects', () => {
    const { result, rerender } = renderHook(() => usePodStatus(), { wrapper });
    act(() => deviceSays(report));
    expect(result.current).not.toBeNull();
    mockStatus = 'disconnected';
    rerender({});
    expect(result.current).toBeNull();
  });

  it('is null outside the provider (screens rendered alone in tests)', () => {
    const { result } = renderHook(() => usePodStatus());
    expect(result.current).toBeNull();
  });
});
