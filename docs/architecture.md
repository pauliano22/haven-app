# System architecture

## End-to-end signal path

```
┌─────────────────────┐   BLE (Nordic UART Service)   ┌──────────────────────┐
│  haven_app          │  newline-terminated JSON,     │  nrf52_haven_fw      │
│  Expo / RN 0.85     │  MTU 247, write-with-response │  Zephyr / NCS        │
│  react-native-ble-plx│ ────────────────────────────▶│  NUS peripheral      │
└─────────────────────┘                               │  "Haven"             │
                                                      │        │ I2C (ctrl)  │
                                                      │        │ SPI (bulk)  │
                                                      │        ▼             │
                                                      │  ADAU1860 DSP        │
                                                      │  ≤5 biquad cascade   │
                                                      └──────────────────────┘
```

The app is a pure remote control: all audio processing happens on the device.
The app sends filter parameters; the firmware computes biquad coefficients and
(eventually) safeloads them into the ADAU1860's parameter RAM.

## Repositories

### `haven_app` — mobile app (this repo)
Expo SDK 56, React Native 0.85, TypeScript, `react-native-ble-plx`. See
[app-guide.md](app-guide.md).

### `nrf52_haven_fw` — production firmware
nRF Connect SDK (Zephyr) application. Layers:

- `src/ble_transport.c` — NUS peripheral advertising as `Haven`; reassembles
  newline-framed lines (512-byte cap); auto re-advertises on disconnect;
  `ble_transport_send()` exists for future device→app acks.
- `src/protocol.c` — allocation-free parser for the fixed JSON schema; clamps
  every parameter (see [ble-protocol.md](ble-protocol.md)); host-unit-tested.
- `src/adau1860.c` — RBJ biquad math (notch + variable-depth peaking cut) at
  48 kHz. **I2C/SPI transactions are placeholders** pending the production PCB
  and the SigmaStudio+ parameter RAM map.
- `boards/nrf52840dk_nrf52840.overlay` — devkit wiring (ADAU1860 at I2C 0x28,
  SPI1 for bulk download). Replace with production netlist.

Build: `west build -b nrf52840dk/nrf52840 .` inside an NCS workspace.

### Legacy prototypes (keep for reference, do not extend)
- `teensy_hearing_shield` — validated Teensy 4.1 + SGTL5000 prototype. Its
  `main.cpp` defined the original wire protocol and the multi-band cascade
  design the production firmware inherits.
- `tinnitus_dsp` — desktop C++ sandbox (RtAudio real-time notch, offline test
  runners, `test_filter.py` numpy verification of the biquad math).

## History

Named AcousticShield until Aug 2026 (renamed to Haven in app commit `b345a9f`
and firmware commit `d766d46`). The Teensy prototype validated the DSP approach;
the nRF52 + ADAU1860 PCB is the production target.
