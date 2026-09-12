import { __mock, FakeDevice } from '../../__mocks__/react-native-ble-plx';
import { UART_SERVICE_UUID } from '../constants/ble';
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
});
