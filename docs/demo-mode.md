# Demo mode

The real app, running in a browser against a simulated Haven device, so
every screen can be shown without hardware. Web only; it never turns on in
a native build.

## Running it

- Dev server: `npm run web:demo`, or `npm run web` and open the page with
  `?demo=1`.
- Static export for GitHub Pages: `npm run export:demo` writes `dist-demo/`
  (gitignored), built for the sub-path `/haven-website/demo/`. For another
  path, set `EXPO_PUBLIC_BASE_URL` yourself
  (`EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_BASE_URL=/your/path npx expo export --platform web`).
  `app.config.js` reads that variable; when it's unset nothing changes.

It turns on only when `EXPO_PUBLIC_DEMO=1` is set at build time or the URL
has `?demo=1` (`src/utils/demoMode.ts`). A strip at the top of every screen
says "Demo · Simulated device · example data", with Mute and Reset buttons.

## What's simulated

`src/services/DemoDevice.ts` stands in for the firmware. It takes the same
`DspPayload` objects the app writes over NUS and answers with the same
newline-terminated JSON lines the firmware's `src/ack.c` sends
(haven-zephyr-app `docs/nus-acks.md`). The app parses them with the real
`parseDeviceLine()`, through `src/context/DemoBleProvider.tsx`, which exposes
the same `BleContextValue` as the native and bench providers.

| Firmware behaviour | In the demo |
|---|---|
| Boot event on connect | `fw: "0.1.0-demo"`, `dac_source: "fdsp"` (limiter path, so hearing tests are allowed) |
| `MULTI_FILTER` ack | Applied band count after the 5-band cap; values clamped to the protocol ranges |
| `BYPASS` ack | Echoes `enabled` |
| Tone ceiling | 85 dB, independent of the app's own clamp; acks report the applied value |
| Tone watchdog | No `TONE_LEVEL` for 3 s silences the tone, then sends `tone_watchdog` |
| Link loss | Disconnect silences any tone; filter/bypass writes made while disconnected are sent on reconnect |
| Battery | Starts at 82%, drops 1% a minute while connected, floors at 20% (shown in the demo strip only) |

The device connects by itself on load. The connect/disconnect controls work.

**Sound.** `src/services/demoAudio.ts` plays the simulated tone with Web Audio
after a tap. Device levels are nominal, not calibrated SPL, so they map onto
a quiet range: the 85 dB ceiling plays at −30 dBFS and lower levels scale down
from there. Mute in the demo strip silences it.

**Safety.** Nothing in the app's safety path is changed for the demo:
`clampToneLevel()`, the LDL ramp limits, the burst durations and the
limiter-path gate all run as in production, and the simulated device adds
the firmware's own ceiling and watchdog on top. `src/services/DemoDevice.test.ts`
covers the ceiling, the watchdog, keep-alives, stop/disconnect and the band
cap.

## Example data

`src/services/demoSeed.ts` writes made-up history the first time the demo
runs in a browser, under the same storage keys the real stores use: three
softened bands, two loudness comfort test runs, two sound-match runs, four
weekly check-ins, two THI runs, a 28-day on/off trial at day 12 (today is an
"on" day, so the demo opens protected), a tolerance plan, comfort responses,
consent and two weeks of exposure log. Reset clears every Haven key and
writes it again. `src/services/demoSeed.test.ts` checks that the example
values stay inside the app's own limits.

## What's real

Every screen, hook, store, clamp and parser is the production code. Only the
radio is replaced. Nothing here says anything about real audio: sound
quality, latency and calibrated loudness need hardware.
