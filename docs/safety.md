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

## Defense in depth — firmware side (NOT YET IMPLEMENTED)

The app-side cap is one layer. The firmware must add an **independent**
ceiling and its own tone watchdog (auto-silence if no TONE_LEVEL keep-alive
arrives within a few seconds), so a frozen app or hostile peer cannot hold a
loud tone. Tracked in [roadmap.md](roadmap.md) — treat as a hardware bring-up
blocker, not a nice-to-have.

## Related choices

- LDL results are interpreted conservatively: only frequencies uncomfortable
  at ≤ 70 dB (`SENSITIVE_LDL_THRESHOLD_DB`) become dampening bands.
- Dampening depth from results is bounded by the DSP clamp (max 40 dB cut).
- The level meter's scale is capped at the ceiling — the UI cannot even
  *depict* a level above 85 dB.
