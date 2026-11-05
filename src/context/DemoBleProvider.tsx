import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DemoAudio } from '../services/demoAudio';
import { getDemoDevice } from '../services/DemoDevice';
import { BleContextValue, DeviceBootInfo, DeviceMessage, DspPayload, TimestampedDeviceMessage } from '../types';
import { LineBuffer, parseDeviceLine } from '../utils/deviceMessages';

/**
 * Demo mode's BLE layer (docs/demo-mode.md): the same BleContextValue the
 * real providers expose, backed by DemoDevice instead of a radio. Device
 * lines go through the real LineBuffer + parseDeviceLine, so acks, the boot
 * event and the tone watchdog reach the app exactly as they would from
 * firmware.
 */

export interface DemoControls {
  battery: number;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** True while the simulated speaker is playing a tone. */
  toneActive: boolean;
}

const DemoControlsContext = createContext<DemoControls | null>(null);

export function useDemoControls(): DemoControls | null {
  return useContext(DemoControlsContext);
}

export function DemoBleProvider({
  context,
  children,
}: {
  context: React.Context<BleContextValue | null>;
  children: React.ReactNode;
}) {
  const device = getDemoDevice();
  const audio = useMemo(() => new DemoAudio(), []);
  const [status, setStatus] = useState(() => device.getStatus());
  const [lastMessage, setLastMessage] = useState<TimestampedDeviceMessage | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceBootInfo | null>(null);
  const [battery, setBattery] = useState(() => device.getBattery());
  const [muted, setMutedState] = useState(false);
  const [toneActive, setToneActive] = useState(false);
  const listeners = useRef(new Set<(m: DeviceMessage) => void>());
  // Like BleConnectionManager: filter/bypass state written while disconnected
  // is kept (latest of each) and flushed on connect. Tones are never queued.
  const pending = useRef<Partial<Record<'MULTI_FILTER' | 'BYPASS', DspPayload>>>({});

  useEffect(() => {
    const buffer = new LineBuffer();
    const subs = [
      device.onStatusChange((s) => {
        setStatus(s);
        if (s !== 'connected') {
          setDeviceInfo(null);
          buffer.reset();
        } else {
          const queued = Object.values(pending.current);
          pending.current = {};
          queued.forEach((p) => p && device.write(p));
        }
      }),
      device.onLine((chunk) => {
        for (const line of buffer.feed(chunk)) {
          const message = parseDeviceLine(line);
          if (!message) continue;
          if (message.kind === 'event' && message.event === 'boot') {
            setDeviceInfo({ fw: message.fw, fdspRate: message.fdspRate, dacSource: message.dacSource });
          }
          setLastMessage({ message, at: Date.now() });
          listeners.current.forEach((l) => l(message));
        }
      }),
      device.onToneChange((tone) => {
        setToneActive(tone !== null);
        audio.play(tone);
      }),
      device.onBatteryChange(setBattery),
    ];
    // Start connected-ish, the way the app looks once paired: connect on load.
    device.connect();
    return () => {
      subs.forEach((s) => s.remove());
      audio.play(null);
    };
  }, [device, audio]);

  const connect = useCallback(() => device.connect(), [device]);
  const disconnect = useCallback(() => device.disconnect(), [device]);

  const sendPayload = useCallback(
    async (payload: DspPayload) => {
      if (device.getStatus() === 'connected') {
        device.write(payload);
      } else if (payload.type === 'MULTI_FILTER' || payload.type === 'BYPASS') {
        pending.current[payload.type] = payload;
      }
    },
    [device],
  );

  const onDeviceMessage = useCallback((listener: (m: DeviceMessage) => void) => {
    listeners.current.add(listener);
    return { remove: () => listeners.current.delete(listener) };
  }, []);

  const setMuted = useCallback(
    (m: boolean) => {
      audio.setMuted(m);
      setMutedState(m);
    },
    [audio],
  );

  const noBench = useCallback(async () => {
    throw new Error('Bench controls are not part of the demo device');
  }, []);

  const Ctx = context;
  return (
    <Ctx.Provider
      value={{
        status,
        queuedCount: Object.keys(pending.current).length,
        connect,
        disconnect,
        sendPayload,
        lastMessage,
        deviceInfo,
        onDeviceMessage,
        benchAvailable: false,
        benchVolume: null,
        benchFreqRange: null,
        setBenchVolume: noBench,
        setBenchFreqRange: noBench,
      }}
    >
      <DemoControlsContext.Provider value={{ battery, muted, setMuted, toneActive }}>
        {children}
      </DemoControlsContext.Provider>
    </Ctx.Provider>
  );
}
