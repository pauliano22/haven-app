import React, { createContext, useCallback, useContext, useState } from 'react';
import { BleContextValue, ConnectionStatus, DspPayload } from '../types';

// No-op web stub — BLE is not available in browsers.
const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [status] = useState<ConnectionStatus>('idle');

  const connect = useCallback(() => {
    alert('Bluetooth is not available in web preview mode. Build for iOS/Android to use BLE.');
  }, []);

  const disconnect = useCallback(async () => {}, []);

  const sendPayload = useCallback(async (_payload: DspPayload) => {}, []);

  return (
    <BleContext.Provider value={{ status, queuedCount: 0, connect, disconnect, sendPayload }}>
      {children}
    </BleContext.Provider>
  );
}

export function useBle(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error('useBle must be used inside <BleProvider>');
  return ctx;
}
