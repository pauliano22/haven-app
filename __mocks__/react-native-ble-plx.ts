// Manual mock for the native react-native-ble-plx module — Jest auto-uses
// this for any `import ... from 'react-native-ble-plx'` since it lives in a
// root-level __mocks__/ directory adjacent to node_modules. Exposes a
// `__mock` namespace (not part of the real package) that tests use to
// script scan/connect/disconnect behavior.

type Listener = (...args: unknown[]) => void;

export const State = {
  Unknown: 'Unknown',
  Resetting: 'Resetting',
  Unsupported: 'Unsupported',
  Unauthorized: 'Unauthorized',
  PoweredOff: 'PoweredOff',
  PoweredOn: 'PoweredOn',
} as const;

export class FakeDevice {
  id: string;
  name: string | null;
  localName: string | null;
  discoverAllServicesAndCharacteristics = jest.fn().mockResolvedValue(undefined);
  services = jest.fn().mockResolvedValue([]);
  requestMTU = jest.fn().mockResolvedValue(undefined);
  writeCharacteristicWithResponseForService = jest.fn().mockResolvedValue(undefined);
  readCharacteristicForService = jest.fn();
  monitorCharacteristicForService = jest.fn(() => ({ remove: () => {} }));
  cancelConnection = jest.fn().mockResolvedValue(undefined);

  constructor(id: string, name: string | null) {
    this.id = id;
    this.name = name;
    this.localName = name;
  }
}

type ScanOutcome = FakeDevice | 'timeout' | Error | null;

let currentAdapterState: string = State.PoweredOn;
let scanOutcome: ScanOutcome = null;
let lastManager: FakeBleManager | null = null;

export class FakeBleManager {
  onStateChangeCb: Listener | null = null;
  disconnectCbs = new Map<string, Listener>();
  destroyed = false;

  constructor() {
    lastManager = this;
  }

  onStateChange(cb: Listener) {
    this.onStateChangeCb = cb;
    return { remove: () => { this.onStateChangeCb = null; } };
  }

  async state() {
    return currentAdapterState;
  }

  startDeviceScan(_uuids: unknown, _options: unknown, cb: (error: unknown, device: unknown) => void) {
    Promise.resolve().then(() => {
      if (scanOutcome instanceof Error) cb(scanOutcome, null);
      else if (scanOutcome && scanOutcome !== 'timeout') cb(null, scanOutcome);
      // 'timeout' / null: never calls back — the real SCAN_TIMEOUT_MS timer
      // in BleConnectionManager is what settles the promise; tests exercising
      // that path use fake timers.
    });
  }

  stopDeviceScan() {}

  async connectToDevice(_id: string) {
    if (!scanOutcome || scanOutcome === 'timeout' || scanOutcome instanceof Error) {
      throw new Error('No device configured to connect to in this test.');
    }
    return scanOutcome;
  }

  async cancelDeviceConnection(_id: string) {}

  onDeviceDisconnected(id: string, cb: Listener) {
    this.disconnectCbs.set(id, cb);
    return { remove: () => this.disconnectCbs.delete(id) };
  }

  destroy() {
    this.destroyed = true;
  }
}

export const BleManager = FakeBleManager;
export type Device = FakeDevice;
export interface Subscription {
  remove: () => void;
}

export const __mock = {
  reset() {
    currentAdapterState = State.PoweredOn;
    scanOutcome = null;
    lastManager = null;
  },
  setAdapterState(state: string) {
    currentAdapterState = state;
  },
  setScanOutcome(outcome: ScanOutcome) {
    scanOutcome = outcome;
  },
  getManager(): FakeBleManager | null {
    return lastManager;
  },
  triggerDisconnect(deviceId: string) {
    lastManager?.disconnectCbs.get(deviceId)?.();
  },
  triggerAdapterState(state: string) {
    currentAdapterState = state;
    lastManager?.onStateChangeCb?.(state);
  },
};
