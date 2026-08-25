import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getWebBenchBle } from '../services/WebBenchBle';
import { BenchFreqRange, BleContextValue, DspPayload } from '../types';

const BleContext = createContext<BleContextValue | null>(null);

/**
 * Web build: only the nRF5340 DK bench controls (Haven Audio Control
 * Service) are wired up here, via real Web Bluetooth — see
 * src/services/WebBenchBle.ts for why this is deliberately not a web port
 * of the full production JSON/NUS protocol (react-native-ble-plx, which
 * speaks that, is native-only).
 */
export function BleProvider({ children }: { children: React.ReactNode }) {
  const client = getWebBenchBle();
  const [status, setStatus] = useState(() => client.getStatus());
  const [benchVolume, setBenchVolumeState] = useState(() => client.getVolume());
  const [benchFreqRange, setBenchFreqRangeState] = useState(() => client.getFreqRange());

  useEffect(() => {
    const subs = [
      client.onStatusChange(setStatus),
      client.onVolumeChange(setBenchVolumeState),
      client.onFreqRangeChange(setBenchFreqRangeState),
      client.onError((message) => alert(message)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [client]);

  const connect = useCallback(() => {
    void client.connect();
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  // The production JSON/NUS protocol has no Web Bluetooth port (see file
  // header) -- only the bench controls below are real on web.
  const sendPayload = useCallback(async (_payload: DspPayload) => {}, []);

  const setBenchVolume = useCallback((percent: number) => client.setVolume(percent), [client]);
  const setBenchFreqRange = useCallback(
    (range: BenchFreqRange) => client.setFreqRange(range),
    [client],
  );

  return (
    <BleContext.Provider
      value={{
        status,
        queuedCount: 0,
        connect,
        disconnect,
        sendPayload,
        benchAvailable: status === 'connected',
        benchVolume,
        benchFreqRange,
        setBenchVolume,
        setBenchFreqRange,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBle(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error('useBle must be used inside <BleProvider>');
  return ctx;
}
