# Trigger diary

Status: built on branch `feature/trigger-diary`, not merged. Browser listening only; the phone build
needs a native audio module (see `dev-client-build.md`).

Purpose: find out what makes a given person's sounds hurt, before building filters on guesses. See
`ADAPTIVE_PROTECTION_DESIGN.md` in the haven-workspace root for why.

How it works
- `SoundCapture.web.ts` reads the microphone spectrum once a second and emits one averaged frame per
  5 s: the level in seven octave bands plus overall level. Audio is analysed, never recorded.
- Levels are relative to full scale. A phone mic is uncalibrated: never compare with the 85 dB ceiling.
- `SoundDiaryStore.ts` keeps frames (about 3 days) and taps ("that hurt" / "that was fine") in
  AsyncStorage. Nothing is written without consent; withdrawing consent deletes the diary too.
- `triggerAnalysis.ts` compares the 30 s before each hurt tap with the 30 s before each fine tap, for
  overall level, peak, sudden rise, the last 10 minutes of exposure, and each band, using AUC (the
  chance a hurt moment scores higher than a fine one). Nothing is shown until there are 5 taps of
  each kind. "Suggestive" means AUC at least 0.25 away from 0.5. It is a prompt to keep logging,
  not a finding.

Not done: native (phone) listening, including the diary in the data export, tapping from the device
itself, correlating with tinnitus spikes (needs a rating after the fact).
