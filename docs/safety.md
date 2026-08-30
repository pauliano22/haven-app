# Output-level safety

Haven commands a device that plays sound directly into a sensitive person's
ear. The LDL (Loudness Discomfort Level) test deliberately approaches the
user's discomfort threshold. **Any change to tone or level code is a
clinical-safety change and needs review.**

## The invariants (do not weaken)

All limits live in one file: `src/constants/safety.ts`. They are hard-coded on
purpose — not configurable at runtime, not stored in state, not reachable from
any settings UI.

1. **85 dB absolute ceiling** (`MAX_TONE_LEVEL_DB`). Every level placed in a
   tone payload must pass through `clampToneLevel()` — the single choke point.
   Never construct a `TONE_*` payload with a hand-written level.
2. **Slow, predictable approach**: ramps start at 30 dB and rise 2 dB per
   700 ms. The user always has time to react.
3. **Auto-stop fail-safes** (in `useLdlTone`):
   - reaching the ceiling parks briefly, then stops and records "comfortable
     up to the safe limit";
   - an absolute 25 s watchdog stops the tone regardless of any other logic;
   - unmounting the screen stops the tone;
   - losing the BLE link stops the tone state machine immediately.
4. **No offline replay**: tones refuse to start unless the link is currently
   `connected`, so a stale `TONE_START` can never sit in the reconnect queue
   and blast on re-link. (Filter payloads may queue; tone payloads must not.)
5. **The STOP button** (`LdlToneStep`) is huge (130 pt), vermilion, isolated,
   and always reachable while a tone plays. Keep it that way.

## Defense in depth — firmware side (implemented 2026-08-25)

The app-side cap is one layer. The firmware (`haven-zephyr-app`) now adds an
**independent** second layer, so a frozen app or hostile peer cannot hold a
loud tone:

- `PROTOCOL_TONE_LEVEL_MAX_DB` (85, `src/protocol.h`) clamps every
  `TONE_START`/`TONE_LEVEL` on-device, defined completely separately from
  this app's own `MAX_TONE_LEVEL_DB` — the two are intentionally not derived
  from one another.
- `src/tone_safety.c` owns a 3-second keep-alive watchdog: if no
  `TONE_LEVEL` arrives within that window, the firmware auto-silences the
  tone on its own. This app's own ramp cadence (`LDL_RAMP_INTERVAL_MS` =
  700ms) and hold-at-cap delay (2100ms) both comfortably clear that window,
  so a healthy test session never trips it — only a genuinely frozen/dead
  client does.
- BLE disconnect force-stops any active tone on the firmware side too,
  independent of this app's own `useLdlTone` link-loss handling.

Verified on physical hardware: a `TONE_START` with no follow-up produces
`tone_safety: Tone watchdog fired -- no TONE_LEVEL keep-alive within 3000
ms, auto-silencing` in the firmware's log, and the tone stops with zero
further input. See `haven-zephyr-app` commit `a8f38cf`.

## "Match your sound" — short burst tones (`usePreviewTone`)

The pitch/loudness matching flow (`PitchMatchTest`) never approaches
discomfort — every tone is a short, fixed-duration burst at a comfortable,
capped level (`MATCH_PITCH_TONE_LEVEL_DB` = 55 dB for pitch comparisons; the
loudness-match slider is bounded to `MATCH_LOUDNESS_MIN_DB`–`MATCH_LOUDNESS_MAX_DB`
= 10–70 dB). `usePreviewTone` has no ramp and therefore no keep-alive loop:
`MATCH_BURST_DURATION_MS` (1400ms) is kept well under the firmware's 3s
`TONE_LEVEL` watchdog, so a single `TONE_START`/`TONE_STOP` pair per burst is
safe on its own. Same link-loss/unmount kill behavior as `useLdlTone`.

## Related choices

- LDL results are interpreted conservatively: only frequencies uncomfortable
  at ≤ 70 dB (`SENSITIVE_LDL_THRESHOLD_DB`) become dampening bands.
- Dampening depth from results is bounded by the DSP clamp (max 40 dB cut).
- The level meter's scale is capped at the ceiling — the UI cannot even
  *depict* a level above 85 dB.
