export const DEVICE_NAME = 'AcousticShield';

// Nordic UART Service
export const UART_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';

// Write JSON payloads to this characteristic (device RX = app TX)
export const UART_RX_CHAR_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

// Receive notifications from this characteristic (device TX = app RX)
export const UART_TX_CHAR_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

export const SCAN_TIMEOUT_MS = 15000;
