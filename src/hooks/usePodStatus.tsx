import React, { createContext, useContext, useEffect, useState } from 'react';
import { useBle } from '../context/BleContext';
import { DevicePodStatus } from '../types';

const PodStatusContext = createContext<DevicePodStatus | null>(null);

/**
 * Keeps the latest pod self-test / status report (firmware sends it on connect and every 30 s)
 * for the whole app, so a screen opened after the report arrived still shows it. Cleared on
 * disconnect. Mount once, inside BleProvider.
 */
export function PodStatusProvider({ children }: { children: React.ReactNode }) {
  const { status, onDeviceMessage } = useBle();
  const [pod, setPod] = useState<DevicePodStatus | null>(null);

  useEffect(() => {
    const sub = onDeviceMessage((m) => {
      if (m.kind === 'event' && m.event === 'status') {
        const { kind: _kind, event: _event, ...report } = m;
        setPod(report);
      }
    });
    return () => sub.remove();
  }, [onDeviceMessage]);

  useEffect(() => {
    if (status !== 'connected') setPod(null);
  }, [status]);

  return <PodStatusContext.Provider value={pod}>{children}</PodStatusContext.Provider>;
}

/**
 * Latest pod status, or null while disconnected, before the first report, with older firmware
 * that never sends one, or outside PodStatusProvider. null is always a valid, quiet state.
 */
export function usePodStatus(): DevicePodStatus | null {
  return useContext(PodStatusContext);
}
