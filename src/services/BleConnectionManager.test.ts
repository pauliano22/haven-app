import { __mock, FakeDevice } from '../../__mocks__/react-native-ble-plx';
import { UART_SERVICE_UUID, UART_TX_CHAR_UUID } from '../constants/ble';
import { DeviceMessage } from '../types';
import { BleConnectionManager } from './BleConnectionManager';

/** Drains pending microtask chains (awaited promise hops inside the manager). */
async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

function havenDevice(overrides: Partial<FakeDevice> = {}): FakeDevice {
  const device = new FakeDevice('device-1', 'Haven');
  device.services = jest.fn().mockResolvedValue([{ uuid: UART_SERVICE_UUID }]);
  Object.assign(device, overrides);
  return device;
}

describe('BleConnectionManager', () => {
  let manager: BleConnectionManager;

  beforeEach(() => {
    __mock.reset();
    manager = new BleConnectionManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('starts idle with an empty queue', () => {
    expect(manager.getStatus()).toBe('idle');
    expect(manager.getQueuedCount()).toBe(0);
  });

  it('connects successfully to a device advertising the UART service', async () => {
    const statuses: string[] = [];
    manager.onStatusChange((s) => statuses.push(s));

    __mock.setScanOutcome(havenDevice());
    await manager.connect();

    expect(manager.getStatus()).toBe('connected');
    expect(statuses).toEqual(['scanning', 'connecting', 'connected']);
  });

  it('fails the connection and emits a connect error when the UART service is missing', async () => {
    const errors: string[] = [];
    manager.onError((e) => errors.push(e.context));

    const device = havenDevice({ services: jest.fn().mockResolvedValue([]) } as any);
    __mock.setScanOutcome(device);
    await manager.connect();

    expect(manager.getStatus()).toBe('disconnected');
    expect(errors).toEqual(['connect']);
  });

  it('queues a payload while offline and flushes it once connected', async () => {
    manager.send({ type: 'BYPASS', enabled: true });
    expect(manager.getQueuedCount()).toBe(1);

    const device = havenDevice();
    __mock.setScanOutcome(device);
    await manager.connect();

    expect(manager.getQueuedCount()).toBe(0);
    expect(device.writeCharacteristicWithResponseForService).toHaveBeenCalledTimes(1);
    const [, , base64Payload] = device.writeCharacteristicWithResponseForService.mock.calls[0];
    const written = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8').trim());
    expect(written).toEqual({ type: 'BYPASS', enabled: true });
  });

  it('coalesces repeated sends of the same payload type into the latest value', async () => {
    manager.send({ type: 'MULTI_FILTER', bands: [{ f0: 1000, Q: 5, atten_db: 10 }] });
    manager.send({ type: 'MULTI_FILTER', bands: [{ f0: 2000, Q: 8, atten_db: 15 }] });
    expect(manager.getQueuedCount()).toBe(1);

    const device = havenDevice();
    __mock.setScanOutcome(device);
    await manager.connect();

    expect(device.writeCharacteristicWithResponseForService).toHaveBeenCalledTimes(1);
    const [, , base64Payload] = device.writeCharacteristicWithResponseForService.mock.calls[0];
    const written = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8').trim());
    expect(written.bands[0].f0).toBe(2000);
  });

  it('moves to reconnecting after an unexpected disconnect, then reconnects', async () => {
    const device = havenDevice();
    __mock.setScanOutcome(device);
    await manager.connect();
    expect(manager.getStatus()).toBe('connected');

    const statuses: string[] = [];
    manager.onStatusChange((s) => statuses.push(s));

    __mock.triggerDisconnect(device.id);
    expect(manager.getStatus()).toBe('reconnecting');

    // Let the reconnect loop's direct-by-id attempt resolve.
    await flushMicrotasks();

    expect(manager.getStatus()).toBe('connected');
    expect(statuses).toContain('reconnecting');
    expect(statuses[statuses.length - 1]).toBe('connected');
  });

  it('does not auto-reconnect after a user-initiated disconnect', async () => {
    const device = havenDevice();
    __mock.setScanOutcome(device);
    await manager.connect();

    await manager.disconnect();
    expect(manager.getStatus()).toBe('idle');

    __mock.triggerDisconnect(device.id);
    expect(manager.getStatus()).toBe('idle');
  });

  // ── Device → app messages (NUS TX) ───────────────────────────────────────

  type MonitorCb = (error: unknown, char: { value: string | null } | null) => void;

  /** Connects and returns the callback the manager registered for NUS TX. */
  async function connectAndCaptureTx(device: FakeDevice): Promise<MonitorCb> {
    const removeTx = jest.fn();
    device.monitorCharacteristicForService = jest.fn(
      (_svc: string, char: string) => ({ remove: char === UART_TX_CHAR_UUID ? removeTx : () => {} }),
    ) as any;
    __mock.setScanOutcome(device);
    await manager.connect();
    const call = (device.monitorCharacteristicForService as jest.Mock).mock.calls.find(
      ([svc, char]) => svc === UART_SERVICE_UUID && char === UART_TX_CHAR_UUID,
    );
    expect(call).toBeDefined();
    (device as any).__removeTx = removeTx;
    return call![2] as MonitorCb;
  }

  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

  it('subscribes to NUS TX on connect, before the first write goes out', async () => {
    const device = havenDevice();
    const order: string[] = [];
    device.writeCharacteristicWithResponseForService = jest.fn(async () => {
      order.push('write');
    }) as any;
    device.monitorCharacteristicForService = jest.fn((_svc: string, char: string) => {
      if (char === UART_TX_CHAR_UUID) order.push('subscribe');
      return { remove: () => {} };
    }) as any;

    manager.send({ type: 'BYPASS', enabled: true }); // queued offline, flushed on connect
    __mock.setScanOutcome(device);
    await manager.connect();

    expect(order[0]).toBe('subscribe');
    expect(order).toContain('write');
  });

  it('parses a whole-line notification into a typed ack', async () => {
    const device = havenDevice();
    const messages: DeviceMessage[] = [];
    manager.onDeviceMessage((m) => messages.push(m));
    const tx = await connectAndCaptureTx(device);

    tx(null, { value: b64('{"ack":"MULTI_FILTER","ok":true,"bands":2}\n') });

    expect(messages).toEqual([{ kind: 'ack', cmd: 'MULTI_FILTER', ok: true, bands: 2 }]);
  });

  it('reassembles a line split across two notifications and splits two lines in one', async () => {
    const device = havenDevice();
    const messages: DeviceMessage[] = [];
    manager.onDeviceMessage((m) => messages.push(m));
    const tx = await connectAndCaptureTx(device);

    tx(null, { value: b64('{"ack":"TONE_ST') });
    expect(messages).toHaveLength(0);
    tx(null, { value: b64('OP","ok":true}\n{"event":"tone_watchdog"}\n') });

    expect(messages).toEqual([
      { kind: 'ack', cmd: 'TONE_STOP', ok: true },
      { kind: 'event', event: 'tone_watchdog' },
    ]);
  });

  it('drops garbage and unknown lines without throwing or emitting', async () => {
    const device = havenDevice();
    const messages: DeviceMessage[] = [];
    manager.onDeviceMessage((m) => messages.push(m));
    const tx = await connectAndCaptureTx(device);

    expect(() => {
      tx(null, { value: b64('not json\n{"type":"ACK","cmd":"BYPASS"}\n{"event":"battery"}\n') });
      tx(null, { value: '%%%not-base64%%%' });
      tx(new Error('monitor failed'), null);
      tx(null, { value: null });
    }).not.toThrow();

    expect(messages).toEqual([]);
  });

  it('records the boot event as deviceInfo and clears it on disconnect', async () => {
    const device = havenDevice();
    const infos: unknown[] = [];
    manager.onDeviceInfoChange((i) => infos.push(i));
    const tx = await connectAndCaptureTx(device);
    expect(manager.getDeviceInfo()).toBeNull();

    tx(null, {
      value: b64('{"event":"boot","fw":"0.1.0-dev","fdsp_rate":192000,"dac_source":"dmic_direct"}\n'),
    });

    expect(manager.getDeviceInfo()).toEqual({
      fw: '0.1.0-dev',
      fdspRate: 192000,
      dacSource: 'dmic_direct',
    });

    await manager.disconnect();

    expect(manager.getDeviceInfo()).toBeNull();
    expect((device as any).__removeTx).toHaveBeenCalled();
    expect(infos[infos.length - 1]).toBeNull();
  });

  it('tears down the TX subscription and forgets deviceInfo on an unexpected drop', async () => {
    const device = havenDevice();
    const tx = await connectAndCaptureTx(device);
    tx(null, {
      value: b64('{"event":"boot","fw":"0.1.0-dev","fdsp_rate":192000,"dac_source":"fdsp"}\n'),
    });
    expect(manager.getDeviceInfo()).not.toBeNull();

    __mock.triggerDisconnect(device.id);

    expect(manager.getDeviceInfo()).toBeNull();
    expect((device as any).__removeTx).toHaveBeenCalled();
  });

  it('ignores notifications from a stale subscription after the link was replaced', async () => {
    const device = havenDevice();
    const messages: DeviceMessage[] = [];
    manager.onDeviceMessage((m) => messages.push(m));
    const tx = await connectAndCaptureTx(device);

    await manager.disconnect();
    tx(null, { value: b64('{"ack":"TONE_STOP","ok":true}\n') });

    expect(messages).toEqual([]);
  });
});
