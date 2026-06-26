import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import {
  DEVICE_NAME,
  SCAN_TIMEOUT_MS,
  UART_RX_CHAR_UUID,
  UART_SERVICE_UUID,
} from '../constants/ble';
import { BleContextValue, ConnectionStatus, DspPayload } from '../types';

const BleContext = createContext<BleContextValue | null>(null);

// Singleton BleManager — must not be recreated on re-render
const manager = new BleManager();

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : 23;

  if (sdkVersion >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const deviceRef = useRef<Device | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectSubRef = useRef<{ remove: () => void } | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      scanTimeoutRef.current && clearTimeout(scanTimeoutRef.current);
      disconnectSubRef.current?.remove();
      manager.stopDeviceScan();
      deviceRef.current?.cancelConnection().catch(() => {});
    };
  }, []);

  const stopScan = useCallback(() => {
    manager.stopDeviceScan();
    scanTimeoutRef.current && clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = null;
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    deviceRef.current = null;
    setStatus('disconnected');
  }, []);

  const connectToDevice = useCallback(
    async (device: Device) => {
      try {
        setStatus('connecting');
        const connected = await device.connect({ autoConnect: false });
        await connected.discoverAllServicesAndCharacteristics();

        // Verify Nordic UART service exists
        const services = await connected.services();
        const uartService = services.find(
          (s) => s.uuid.toUpperCase() === UART_SERVICE_UUID.toUpperCase(),
        );
        if (!uartService) {
          throw new Error('Nordic UART Service not found on device.');
        }

        deviceRef.current = connected;

        // Subscribe to disconnection events
        disconnectSubRef.current = manager.onDeviceDisconnected(
          connected.id,
          handleDisconnect,
        );

        setStatus('connected');
      } catch (err: any) {
        setStatus('disconnected');
        Alert.alert('Connection Failed', err?.message ?? 'Unknown error');
      }
    },
    [handleDisconnect],
  );

  const connect = useCallback(async () => {
    if (status === 'scanning' || status === 'connecting' || status === 'connected') return;

    const granted = await requestBlePermissions();
    if (!granted) {
      Alert.alert(
        'Permission Denied',
        'Bluetooth permissions are required to connect to AcousticShield.',
      );
      return;
    }

    // Wait for BLE adapter to be powered on
    const bleState = await manager.state();
    if (bleState !== State.PoweredOn) {
      Alert.alert('Bluetooth Off', 'Please enable Bluetooth and try again.');
      return;
    }

    setStatus('scanning');

    // Scan timeout guard
    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
      setStatus('disconnected');
      Alert.alert('Scan Timeout', `Could not find "${DEVICE_NAME}" nearby.`);
    }, SCAN_TIMEOUT_MS);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        stopScan();
        setStatus('disconnected');
        Alert.alert('Scan Error', error.message);
        return;
      }
      if (device?.localName === DEVICE_NAME || device?.name === DEVICE_NAME) {
        stopScan();
        connectToDevice(device);
      }
    });
  }, [status, stopScan, connectToDevice]);

  const disconnect = useCallback(async () => {
    stopScan();
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    await deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
    setStatus('idle');
  }, [stopScan]);

  const sendPayload = useCallback(async (payload: DspPayload): Promise<void> => {
    if (!deviceRef.current || status !== 'connected') return;
    const json = JSON.stringify(payload);
    const encoded = encodeBase64(json);
    await deviceRef.current.writeCharacteristicWithResponseForService(
      UART_SERVICE_UUID,
      UART_RX_CHAR_UUID,
      encoded,
    );
  }, [status]);

  return (
    <BleContext.Provider value={{ status, connect, disconnect, sendPayload }}>
      {children}
    </BleContext.Provider>
  );
}

export function useBle(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error('useBle must be used inside <BleProvider>');
  return ctx;
}
