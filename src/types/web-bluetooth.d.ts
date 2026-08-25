// Minimal Web Bluetooth API surface -- not in TS's default DOM lib (still a
// draft spec). Scoped to exactly what src/services/WebBenchBle.ts uses, not
// a full spec implementation.

export {};

declare global {
  interface BluetoothLEScanFilter {
    name?: string;
    services?: string[];
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: string[];
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly value?: DataView;
    readValue(): Promise<DataView>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTServer {
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
  }

  interface Bluetooth {
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface Navigator {
    readonly bluetooth?: Bluetooth;
  }
}
