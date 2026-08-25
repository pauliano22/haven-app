# Roadmap & status

Last updated: 2026-08-06. `feature/ldl-dampening` and `design/sanctuary` are
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

1. Production PCB + SigmaStudio+ program export → parameter RAM address map.
2. Real ADAU1860 I2C driver: device-ID check, reset/hibernate sequencing,
   program download over SPI, safeload coefficient writes
   (`haven-zephyr-app`'s `src/adau1860_control.c` placeholders are marked
   `TODO(hw-bringup)` — also covers wiring the tone generator itself to
   real hardware; `tone_safety.c`'s validation/watchdog layer is done, but
   `adau1860_control_set_tone()` and friends are still stub logging).
3. Confirm ADAU1860 coefficient number format (8.24 fixed vs float core) and
   implement the conversion.

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
