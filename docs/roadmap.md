# Roadmap & status

Last updated: 2026-08-05 (post-merge of `feature/ldl-dampening` into master).

## Done

- **App**: multi-band dampening dashboard (≤5 bands, f0/Q/atten sliders,
  visualizer, bypass), robust BLE layer (auto-reconnect, offline queue,
  MTU 247), LDL guided test with hard safety limits, Lamplight Terminal
  design system in dark + light, web preview phone frame, rename to Haven.
- **Firmware scaffold** (`nrf52_haven_fw`): NUS peripheral advertising as
  `Haven`, newline framing, host-tested JSON parser with clamps, RBJ
  notch/peaking-cut coefficient math ported from the validated Teensy
  prototype.
- **Protocol**: aligned end to end (`MULTI_FILTER`, uppercase `Q`, `\n`
  framing, 5-band cap, optional `atten_db`).

## Next — firmware / hardware bring-up (blocking real audio)

1. Production PCB + SigmaStudio+ program export → parameter RAM address map.
2. Real ADAU1860 I2C driver: device-ID check, reset/hibernate sequencing,
   program download over SPI, safeload coefficient writes
   (`src/adau1860.c` placeholders are marked `TODO(hw-bringup)`).
3. **Tone playback path for the LDL test** (`TONE_START/LEVEL/STOP`) with an
   independent firmware level ceiling + keep-alive watchdog — safety blocker,
   see [safety.md](safety.md).
4. Confirm ADAU1860 coefficient number format (8.24 fixed vs float core) and
   implement the conversion.

## Next — app

- Subscribe to NUS TX for device→app acks; surface "applied" state in the TX
  monitor instead of assuming success.
- Persist bands/presets across launches (AsyncStorage) and store LDL results
  history.
- Calibration story: `level_db` is currently nominal — map commanded dB to
  real acoustic output once hardware exists.
- Tests: unit-test `BleConnectionManager` queue/reconnect logic and
  `useLdlTone` invariants.

## Known loose ends

- App repo has an `origin` remote; local master is ahead — push when desired.
- Bundle id is placeholder `com.haven.app` — pick a real reverse-DNS before
  store submission.
- Legacy `teensy_hearing_shield` still speaks the *old* protocol dialect
  (`FILTER_UPDATE`, lowercase handling); it is reference-only now.
- The Claude Code project history path changed when the directory was renamed
  `acoustic_shield_app` → `haven_app` (2026-08-05).
