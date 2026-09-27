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
- **"Match your sound"** (2026-08-30): self-guided tinnitus pitch/loudness
  matching, adaptive 2AFC bisection in log-frequency space (`src/utils/pitchMatch.ts`),
  converging in 5-8 short comparison tones. Feeds straight into a
  personalized softening band (same `applyBands` path as the LDL test).
  Includes an optional 0-10 "how bothersome right now" check-in and a
  persisted run history (`MatchHistoryStore`), same pattern as LDL history.
  The Hearing tab is now a two-tool picker (loudness comfort test / match
  your sound) instead of a single LDL screen. Framed deliberately as
  self-management, not a cure — see the product notes this was scoped from
  for why (notched sound therapy has weak/mixed clinical evidence).
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
- LDL result history/trend view (AsyncStorage-backed).
- Filter bands/bypass persist across app launches (AsyncStorage), and
  re-sync to a freshly connected device once per connection.
- **Comfort check-in** (`ComfortCheckIn`, Tune screen): an occasional
  ("too strong / just right / not enough") prompt that nudges the selected
  band's `attenDb` by a fixed 3dB step and gates itself to once per 24h.
  Deliberately framed as a simple nudge, not a real per-user ML model —
  see `constants/comfort.ts`.
- **Tolerance-building plan** (`TolerancePlanCard`, Tune screen): an
  opt-in, one-band-at-a-time plan that reduces `attenDb` by a fixed 3dB
  step per week, only ever on an explicit tap (never automatic). Honest
  about what Haven's hardware can and can't do here — it has no broadband
  noise generator, so this can't be real sound-generator-based hyperacusis
  therapy; what it *can* do is help counter over-protection (a real,
  documented risk) by gradually easing softening back down. See
  `constants/tolerance.ts`.

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
- ~~Confirm coefficient number format~~ — **Q5.27**, `[b0,b1,b2,-a1,-a2]` (feedback taps negated in the FastDSP slots),
  verified against upstream's `Equalizer.cpp` (its 150 Hz peaking row
  matches RBJ math to five decimals).

What actually remains:

1. **Codec driver port** — done as `haven-zephyr-app` PR #9 (awaiting
   review): power sequencing (`DAC_ENABLE` GPIO + `V_LS` load switch + 35 ms
   settle), PLL/clock setup, DMIC → decimator routing, DAC/headphone amp,
   FastDSP program load, `apply_filters()` as five Q5.27 safeloads with
   negated feedback taps, in-tree `openearable_v2` board. Compiles clean for
   both board targets on NCS v3.4.0 (fork CI, zero warnings); never run on a
   codec yet.
2. ~~A DMIC-input FastDSP program~~ — **not needed for first audio.** PR #9
   decoded upstream's shipped banks: bank 1 is OpenEarable's *transparency*
   mode, i.e. the program is already mic → 5 biquads → DAC hear-through
   (`AUDIO_MODE_TRANSPARENCY` in upstream `hw_codec.h`). What remains on the
   DSP side is Haven-specific tuning in Lark Studio (limiter, DMIC gain) and
   confirming the program's internal routing on hardware.
3. **Tone path for the LDL / pitch-match tests** — done as PR #10 (stacked
   on #9): nRF-side I2S sine (48 kHz, 16-bit, click-free level ramps) into
   the codec, DAC routed to the I2S input while a tone plays and restored
   after. `tone_safety.c`'s clamp + watchdog untouched. Compiles clean; the
   `HAVEN_TONE_FULL_SCALE_DB` mapping is nominal until item 4.
4. **Acoustic calibration of `level_db` → dB SPL — the top open safety
   item.** Every "85 dB" in this app and the firmware is a *nominal* number
   with no measured relationship to sound pressure at the eardrum yet. Until
   commanded level is measured on real hardware (calibrated mic or ear
   simulator) and the constants in `src/constants/safety.ts` are mapped to
   it, the ceiling is a label, not a limit. See [safety.md](safety.md).
5. **Hardware (nothing here is cheap):** three real options now. (a) nRF5340
   DK + ADI EVAL-ADAU1860EBZ (~$535; DMIC and I2S headers, runs Lark
   Studio). (b) A stock OpenEarable 2.0 Developer Starter Bundle (€2,348),
   flashed via J-Link. (c) **The 5× rescaled bench board in
   `haven-dev-board-kicad`** — routing-complete with a fabrication guide, but
   read `HAVEN_HARDWARE_REVIEW.md` §0.7 first: the rescale left both crystals
   and every decoupling cap 8–50 mm from their chips, a placement-only fix
   that is cheap before PCBA and impossible after.
## Next — app

- Verify the redesign on a real iPhone via a dev-client build (see
  app-guide.md — plain Expo Go won't work, `react-native-ble-plx` needs a
  custom build).
- Subscribe to NUS TX for device→app acks; surface "applied"/error state
  somewhere in the new UI (the old TX monitor was intentionally removed as
  too engineering-facing — replace with a quiet toast or Home-screen state,
  not a JSON dump).
- Calibration story: `level_db` is currently nominal — map commanded dB to
  real acoustic output once hardware exists.
- ~~Tests: unit-test `BleConnectionManager` queue/reconnect logic and
  `useLdlTone` invariants.~~ Done — `BleConnectionManager.test.ts` (7 tests:
  offline queue/flush, payload coalescing, reconnect-vs-user-disconnect) and
  `useLdlTone.test.ts` (6 tests), both passing.

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
