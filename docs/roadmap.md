# Roadmap & status

Last updated: 2026-09-10 (firmware/hardware section; app sections as of
2026-08-06). `feature/ldl-dampening` and `design/sanctuary` are
both merged into master. The **Sanctuary/Evergreen** redesign (three-tab
Home/Tune/Hearing structure, Evergreen/Ivory theme) is the current app —
it replaced the single-dashboard "Lamplight Terminal" look. See
[design-system.md](design-system.md) for why that earlier system was
rejected. **Not yet verified on a real device** — has only been checked in
the web preview; confirm on an actual iPhone (see app-guide.md's Expo Go /
dev-client build section) before considering it done.

## Done

- **App**: multi-band dampening (≤5 bands, f0/Q/atten), robust BLE layer
  (auto-reconnect, offline queue, MTU 247), LDL guided test with hard safety
  limits, rename to Haven, full visual + IA redesign — Home/Tune/Hearing
  tabs, Evergreen/Ivory theme, shared `FilterContext`.
- **Brand**: 7 logo concepts designed and reviewed (see
  [design-system.md](design-system.md)#logo). App icon shipped — Concept D
  "Soft H" across every platform size/format, `assets/`. Marketing site
  shipped at [haven-website](https://github.com/pauliano22/haven-website)
  with Concept G "Radiant Bloom" live and the other five swappable.
- **Firmware scaffold** (`nrf52_haven_fw`): NUS peripheral advertising as
  `Haven`, newline framing, host-tested JSON parser with clamps, RBJ
  notch/peaking-cut coefficient math ported from the validated Teensy
  prototype.
- **Protocol**: aligned end to end (`MULTI_FILTER`, uppercase `Q`, `\n`
  framing, 5-band cap, optional `atten_db`).
- **Tone playback path for the LDL test** (`TONE_START`/`LEVEL`/`STOP`),
  with an independent firmware level ceiling (85 dB, separate from this
  app's own cap) and a 3s keep-alive watchdog — verified on physical
  hardware. See [safety.md](safety.md). `haven-zephyr-app` commit `a8f38cf`.

## Next — firmware / hardware bring-up (blocking real audio)

Updated 2026-09-10 after cross-checking against the upstream OpenEarable 2.0
firmware (`OpenEarable/open-earable-2`), which drives the same ADAU1860 on
the same board. Several items that used to be here are resolved by that
code rather than by new work:

- ~~SigmaStudio+ program export → parameter RAM address map~~ — not needed
  for first audio, and SigmaStudio+ is the wrong tool anyway (the
  ADAU1860's design tool is ADI's **Lark Studio**, per the EVAL-ADAU1860
  user guide UG-2017). The ADAU1860 has a public register map (upstream
  `src/drivers/ADAU1860.h`), and upstream's FastDSP program (`Lark-fdsp.c`)
  already has five biquad slots with hardware safeload at known addresses.
- ~~Program download over SPI~~ — there is no SPI path to the codec on this
  board; everything is I2C (`SDA1`/`SCL1`, address 0x64, 32-bit register
  addresses).
- ~~Confirm coefficient number format~~ — **Q5.27**, `[b0,b1,b2,a1,a2]`,
  verified against upstream's `Equalizer.cpp` (its 150 Hz peaking row
  matches RBJ math to five decimals).

What actually remains:

1. **Codec driver port** (`haven-zephyr-app`, see its ADAU1860 driver PR):
   power sequencing (`DAC_ENABLE` GPIO + 1.8 V load switch + 35 ms settle),
   PLL/clock setup, DMIC → decimator routing, DAC/headphone amp, FastDSP
   program load, and `adau1860_control_apply_filters()` as five safeloads.
   Replaces every `TODO(hw-bringup)` stub.
2. **A DMIC-input FastDSP program.** Upstream's program takes I2S audio from
   the phone as its input; hear-through needs the PDM mic as input. In
   Lark Studio the input source is a choice in the FastDSP schematic, and
   "Download to Target" produces the `uint32_t` memory images the firmware
   loads (UG-2017). Alternative: the codec's hardware EQ engine, whose
   input is selected by `EQ_ROUTE` (UG-2017 confirms the register's role;
   untested as a hear-through path). Also decide the FastDSP frame rate —
   upstream clocks it from the 192 kHz DMIC stream, UG-2017 requires the
   filter fs to match `FDSP_RATE_SOURCE`, so coefficient math must use the
   same rate.
3. **Tone path for the LDL test.** Upstream has an nRF-side I2S tone
   generator feeding the codec (nRF is I2S master); wire
   `adau1860_control_set_tone()` / `set_tone_level()` / `stop_tone()` to it
   and to the FastDSP volume/mixer slot. `tone_safety.c`'s clamp + watchdog
   layer is already done.
4. **Acoustic calibration of `level_db` → dB SPL — the top open safety
   item.** Every "85 dB" in this app and the firmware is a *nominal* number
   with no measured relationship to sound pressure at the eardrum yet. Until
   commanded level is measured on real hardware (calibrated mic or ear
   simulator) and the constants in `src/constants/safety.ts` are mapped to
   it, the ceiling is a label, not a limit. See [safety.md](safety.md).
5. **Hardware (nothing here is cheap):** lower-cost bench is an nRF5340 DK
   + ADI EVAL-ADAU1860EBZ (~$535 total; the eval board has DMIC and I2S
   headers so it wires like the real board, and runs Lark Studio). The
   real thing is a stock OpenEarable 2.0 Developer Starter Bundle (€2,348)
   flashed via J-Link. The custom PCB is off the critical path until there's
   a reason to diverge from stock and its review findings are fixed.

## Next — app

- Verify the redesign on a real iPhone via a dev-client build (see
  app-guide.md — plain Expo Go won't work, `react-native-ble-plx` needs a
  custom build).
- Subscribe to NUS TX for device→app acks; surface "applied"/error state
  somewhere in the new UI (the old TX monitor was intentionally removed as
  too engineering-facing — replace with a quiet toast or Home-screen state,
  not a JSON dump).
- Persist bands/presets across launches (AsyncStorage) and store LDL results
  history.
- Calibration story: `level_db` is currently nominal — map commanded dB to
  real acoustic output once hardware exists.
- Tests: unit-test `BleConnectionManager` queue/reconnect logic and
  `useLdlTone` invariants.

## Known loose ends

- Bundle id is placeholder `com.haven.app` — pick a real reverse-DNS before
  store submission.
- Legacy `teensy_hearing_shield` still speaks the *old* protocol dialect
  (`FILTER_UPDATE`, lowercase handling); it is reference-only now, pushed to
  its own repo, [haven-legacy-teensy](https://github.com/pauliano22/haven-legacy-teensy).
- `haven-website`'s GitHub Pages deploy was broken as of 2026-08-06 — not a
  GitHub-wide outage, the legacy Jekyll build was failing on the plain
  static site (no build step). Fixed by adding a `.nojekyll` file to the
  repo root; live at https://pauliano22.github.io/haven-website/, linked
  from the Home screen footer ("About Haven").
- This app now lives at `haven_workspace/mobile_app/haven_custom_app/` (a
  submodule of [haven-workspace](https://github.com/pauliano22/haven-workspace)),
  not a standalone `~/projects/active/` directory — the Claude Code project
  history path has changed twice now (rename, then workspace reorg).
