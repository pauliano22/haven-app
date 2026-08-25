import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert } from 'react-native';
import {
  BleErrorContext,
  getBleConnectionManager,
} from '../services/BleConnectionManager';
import { BenchFreqRange, BleContextValue, DspPayload } from '../types';

const BleContext = createContext<BleContextValue | null>(null);

const ERROR_TITLES: Record<BleErrorContext, string> = {
  permissions: 'Permission Denied',
  adapter: 'Bluetooth Off',
  scan: 'Scan Failed',
  connect: 'Connection Failed',
  reconnect: 'Reconnect Failed',
  write: 'Write Failed',
  'bench-write': 'Bench Control Failed',
};

export function BleProvider({ children }: { children: React.ReactNode }) {
  const manager = getBleConnectionManager();
  const [status, setStatus] = useState(() => manager.getStatus());
  const [queuedCount, setQueuedCount] = useState(() => manager.getQueuedCount());
  const [benchAvailable, setBenchAvailable] = useState(() => manager.isBenchAvailable());
  const [benchVolume, setBenchVolumeState] = useState(() => manager.getBenchVolume());
  const [benchFreqRange, setBenchFreqRangeState] = useState(() => manager.getBenchFreqRange());

  useEffect(() => {
    const subs = [
      manager.onStatusChange(setStatus),
      manager.onQueueChange(setQueuedCount),
      manager.onBenchAvailableChange(setBenchAvailable),
      manager.onBenchVolumeChange(setBenchVolumeState),
      manager.onBenchFreqRangeChange(setBenchFreqRangeState),
      // Background reconnect/write errors stay silent; the service retries them.
      manager.onError((event) => {
        if (event.userInitiated) {
          Alert.alert(ERROR_TITLES[event.context], event.message);
        }
      }),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [manager]);

  const connect = useCallback(() => {
    void manager.connect();
  }, [manager]);

  const disconnect = useCallback(() => {
    void manager.disconnect();
  }, [manager]);

  const sendPayload = useCallback(
    async (payload: DspPayload) => {
      manager.send(payload);
    },
    [manager],
  );

  const setBenchVolume = useCallback(
    (percent: number) => manager.setBenchVolume(percent),
    [manager],
  );

  const setBenchFreqRange = useCallback(
    (range: BenchFreqRange) => manager.setBenchFreqRange(range),
    [manager],
  );

  return (
    <BleContext.Provider
      value={{
        status,
        queuedCount,
        connect,
        disconnect,
        sendPayload,
        benchAvailable,
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
