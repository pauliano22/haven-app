// Shared DSP parameter ranges — must stay in sync with the firmware's
// protocol.h clamps (nrf52_acousticshield_fw).

export const F0_MIN = 200;
export const F0_MAX = 8000;
export const F0_DEFAULT = 4500;

export const Q_MIN = 1.0;
export const Q_MAX = 20.0;
export const Q_DEFAULT = 10.0;

// Matches MAX_BANDS in the firmware — payloads with more bands are truncated
// on-device.
export const MAX_BANDS = 5;

// Dampening depth: how many dB a band reduces its target frequency by.
// ATTEN_MAX_DB is treated by the firmware as a full notch.
export const ATTEN_MIN_DB = 3;
export const ATTEN_MAX_DB = 40;
export const ATTEN_DEFAULT_DB = 20;
