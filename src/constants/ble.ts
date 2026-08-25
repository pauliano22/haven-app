export const DEVICE_NAME = 'Haven';

// Nordic UART Service
export const UART_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';

// Write JSON payloads to this characteristic (device RX = app TX)
export const UART_RX_CHAR_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

// Receive notifications from this characteristic (device TX = app RX)
export const UART_TX_CHAR_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

export const SCAN_TIMEOUT_MS = 15000;

export const CONNECT_TIMEOUT_MS = 10000;

// Negotiated on Android after connect so multi-band JSON payloads fit in one write.
export const REQUESTED_MTU = 247;

// Auto-reconnect backoff schedule
export const RECONNECT_INITIAL_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 30000;

// Reconnect directly by device id this many times before falling back to a scan
// (covers the board coming back with a different identifier).
export const RECONNECT_DIRECT_ATTEMPTS = 3;

// ── Haven Audio Control Service (nRF5340 DK bench firmware only) ───────────
// Prototyping-bench control surface, separate from the JSON/NUS protocol
// above — not present on production hardware, which will speak JSON/NUS
// exclusively once the real DSP board exists. See haven-zephyr-app's
// gatt_audio_service.c / README.md for the firmware side. Not advertised
// (no room left in the scan-response payload alongside NUS's own 128-bit
// UUID) — only discoverable after connecting, hence BleConnectionManager
// treats its absence as "bench features unavailable," not a connect error.
export const BENCH_AUDIO_SERVICE_UUID = '7a1e0001-4b5c-4e8a-9c1a-2f6b8d3c9a10';
export const BENCH_VOLUME_CHAR_UUID = '7a1e0002-4b5c-4e8a-9c1a-2f6b8d3c9a10';
export const BENCH_FREQ_RANGE_CHAR_UUID = '7a1e0003-4b5c-4e8a-9c1a-2f6b8d3c9a10';
