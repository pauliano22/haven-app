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

### LDL-aware match level (`utils/matchLevel.ts`)

55 dB is comfortable for normal hearing, but a hyperacusis user's loudness
discomfort level can sit *below* 55 dB at exactly the frequencies being
matched — and this flow presents tones up to 8 kHz. So when a completed
comfort test exists, the match tones and the loudness slider's ceiling are
capped at `lowest measured LDL − MATCH_LDL_MARGIN_DB` (10 dB), never below
`MATCH_LOUDNESS_MIN_DB`. The cap uses the **most recent** run that measured
anything (LDLs move; that is the point of the tolerance plan), a run that was
comfortable to the ceiling everywhere imposes no cap, and the helper can only
ever *lower* a level — it never raises one past the constants above. Every
value still passes through `clampToneLevel()` at the payload boundary. The
user sees a one-line note ("Kept quieter than usual…") so the quieter tones
aren't mistaken for a fault. See `docs/clinical-basis.md` §1a.

### Octave check (`utils/pitchMatch.ts`)

Not a level change, but a tone-flow change worth recording here: after the
bisection converges, one extra step plays the match against f/2 and 2f at the
same capped level. Same `usePreviewTone` burst path, same watchdog margin.

## LDL drift warning (`utils/ldlDrift.ts`)

Detection, not action. If the user's comfort level at a frequency they are
actively softening has fallen `LDL_DRIFT_WARN_DB` (10 dB) or more below their
first measurement, Tune shows a card offering to pause that band. Pausing
sets `attenDb` to 0 (the same floor the tolerance plan steps toward); nothing
happens without a tap. This is the over-protection signal from Formby et al.
2003 (`docs/clinical-basis.md` §1b) turned into something the app can notice.

## Softening depth policy (`utils/atten.ts`)

Three features can set a band's `attenDb` to 0 — the tolerance plan's final
step, the LDL-drift "pause this band", and the Softening slider itself — so
one module defines what that means: **0 dB is a paused band** (flat response,
kept in the list), and active softening runs from `ATTEN_MIN_DB` up. Values in
between are never produced on purpose; `normalizeAtten` snaps them to the
floor. A comfort nudge can never pause a band (pausing is deliberate), and
"not enough" on a paused band resumes it at the gentlest depth. Not a level
*safety* rule — the DSP clamps everything — but a consistency one, so the UI
never shows a depth the device isn't running.

## Outcome check-ins and the N-of-1 trial (`screens/CheckIn.tsx`)

None of these play sound. The weekly VAS and monthly THI are questionnaires;
the N-of-1 trial only ever sends the same `BYPASS` / `MULTI_FILTER` the Home
orb sends, and only once per connection per trial day — if the user has
already switched protection themselves that day, the app does nothing and
records an override. The user can always tap the orb; the plan is a
suggestion. The results view refuses to compare arms until each has 14 rated
days and never uses the words "works" or "proven".

## Your data (`services/ExposureLog.ts`, `ConsentStore.ts`, `DataExportCard.tsx`)

Interpreting any outcome number requires knowing what the device was doing,
so the app keeps a local log: connection sessions, the active bands and
depths, bypass state, and the check-in ratings. Rules, enforced in code:

1. **Nothing is logged until the user agrees** (`ConsentCard`, shown once;
   consent is versioned, so changed wording asks again).
2. **It never leaves the phone by itself.** The only egress is "Share my
   data", which hands a JSON or CSV to the platform share sheet — the user
   picks the destination.
3. **Withdrawing consent deletes the log** (`useConsent().withdraw`), not
   just stops it.
4. Bounded (`EXPOSURE_LOG_MAX_EVENTS`), no identifiers (there is no
   account), and every exported level is labelled as a *commanded* value,
   not measured sound pressure (see "Not yet calibrated" above / PR #6).

The THI item wording is **not** shipped: it is the instrument authors'
copyright and needs a licensing check before it is shown to anyone outside
the team (`utils/thi.ts`). Scoring, history and trend are real.

## Related choices

- LDL results are interpreted conservatively: only frequencies uncomfortable
  at ≤ 70 dB (`SENSITIVE_LDL_THRESHOLD_DB`) become dampening bands.
- Dampening depth from results is bounded by the DSP clamp (max 40 dB cut).
- The level meter's scale is capped at the ceiling — the UI cannot even
  *depict* a level above 85 dB.
