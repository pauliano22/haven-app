# System architecture

## End-to-end signal path

```
┌─────────────────────┐   BLE (Nordic UART Service)   ┌──────────────────────────┐
│  haven_app          │  newline-terminated JSON,     │  haven-zephyr-app        │
│  Expo / RN 0.85     │  MTU 247, write-with-response │  nRF5340, Zephyr / NCS   │
│  react-native-ble-plx│ ────────────────────────────▶│  NUS peripheral "Haven"  │
└─────────────────────┘                               └───────────┬──────────────┘
                                                                  │ I2C1 control port
                                                                  │ (addr 0x64, 32-bit
                                                                  │  register addresses)
                                                                  ▼
                                    ┌─────────────────────────────────────────────┐
                                    │  ADAU1860 codec / DSP                        │
                                    │  PDM mic ─▶ FastDSP ≤5 biquads ─▶ DAC ─▶ spkr │
                                    │  (audio never leaves the codec)              │
                                    └─────────────────────────────────────────────┘
```

The app is a pure remote control: all audio processing happens on the device,
and on the device it happens entirely inside the codec. The firmware is not on
the audio path either — it computes biquad coefficients from the app's
parameters and writes them into the ADAU1860's FastDSP parameter banks through
the chip's hardware **safeload** registers (`FDSP_SL_ADDR` / `FDSP_SL_P0..P4` /
`FDSP_SL_UPDATE`), which swap all five coefficients of a biquad atomically so a
mid-update frame never runs on a half-written filter. Coefficients are Q5.27
fixed point (1.0 = `0x08000000`), ordered `b0, b1, b2, -a1, -a2` — the
FastDSP slots store the feedback taps negated (verified by decoding upstream's
shipped banks; see `tools/dsp/fdsp_bank_decode.py` in the firmware repo).

Why this shape matters: hear-through only works if mic→speaker latency is well
under a millisecond, otherwise the processed sound comb-filters against sound
leaking past the earpiece. Keeping the nRF out of the loop is what makes that
possible (and what lets it sleep between BLE writes).

## Repositories

### `haven_app` — mobile app (this repo)
Expo SDK 56, React Native 0.85, TypeScript, `react-native-ble-plx`. See
[app-guide.md](app-guide.md).

### `haven-zephyr-app` — production firmware
nRF Connect SDK (Zephyr) application for the **nRF5340** (app core; the BLE
controller runs on the network core via sysbuild). Layers:

- `src/ble_transport.c` — NUS peripheral advertising as `Haven`; reassembles
  newline-framed lines (512-byte cap); auto re-advertises on disconnect;
  `ble_transport_send()` exists for future device→app acks.
- `src/protocol.c` — allocation-free parser for the fixed JSON schema; clamps
  every parameter (see [ble-protocol.md](ble-protocol.md)); host-unit-tested.
- `src/tone_safety.c` — independent firmware-side ceiling + keep-alive
  watchdog for the LDL tone (see [safety.md](safety.md)).
- `src/adau1860_control.c` — RBJ biquad math (notch + variable-depth peaking
  cut), Q5.27 encoding, and the codec driver: power sequencing (`DAC_ENABLE`
  GPIO, load-switched 1.8 V rail, 35 ms common-mode settle, PLL setup,
  `STATUS2` poll), FastDSP program load, and per-band safeload writes. This
  is a port of the driver in the upstream OpenEarable 2.0 firmware
  (`OpenEarable/open-earable-2`, `src/drivers/ADAU1860.*`), which runs on
  the same codec on the same board. Control is **I2C only** — there is no
  SPI path on this board.
- `boards/*.overlay` — the nRF5340 DK overlay for bench work, and the
  OpenEarable-2.0 board wiring (ADAU1860 at I2C **0x64** on the dedicated
  `SDA1`/`SCL1` bus; nRF5340 as I2S **master**, codec as slave).

Build: `west build --board nrf5340dk/nrf5340/cpuapp --sysbuild .` inside an
NCS workspace (see the firmware README for `west init`).

**Hardware note:** a stock OpenEarable 2.0 unit is Haven's production
hardware in every way that matters (same nRF5340 module, ADAU1860, PDM mic,
speaker, enclosure — Haven's PCB is a KiCad port of the stock board), so the
firmware can be flashed onto one with a J-Link without waiting on a custom
board. It is not cheap (Developer Starter Bundle €2,348); the lower-cost
bench is an nRF5340 DK + ADI EVAL-ADAU1860EBZ (~$535), which wires up with
the same topology. The codec's DSP programs are designed in ADI's **Lark
Studio** (not SigmaStudio+) — see the EVAL-ADAU1860 user guide, UG-2017.

### Legacy prototypes (keep for reference, do not extend)
- `teensy_hearing_shield` — validated Teensy 4.1 + SGTL5000 prototype. Its
  `main.cpp` defined the original wire protocol and the multi-band cascade
  design the production firmware inherits.
- `tinnitus_dsp` — desktop C++ sandbox (RtAudio real-time notch, offline test
  runners, `test_filter.py` numpy verification of the biquad math).

## History

Named AcousticShield until Aug 2026 (renamed to Haven in app commit `b345a9f`
and firmware commit `d766d46`). The Teensy prototype validated the DSP approach;
the nRF5340 + ADAU1860 board (OpenEarable 2.0 or Haven's port of it) is the
production target. The firmware repo was briefly called `nrf52_haven_fw` and
briefly targeted an nRF52840 DK; both are historical.
