# App guide

Expo SDK 56 / React Native 0.85 / TypeScript. No navigation library — a simple
screen switch in `App.tsx`. No state library — React context + one plain-TS
service singleton.

## Layout

```
App.tsx                      screen switch (dashboard | ldl), PhoneFrame web wrapper
src/
  screens/
    Dashboard.tsx            main control surface: bands, sliders, bypass, TX monitor
    LdlTest.tsx              LDL test orchestrator (intro → testing → results)
  components/
    ConnectionBar.tsx        status LED + connect/disconnect
    VisualizerCurve.tsx      SVG frequency-response curve
    SectionRule.tsx          patch-bay rule label (design signature)
    Blink.tsx / FadeIn.tsx   the app's only two ambient animations
    ldl/                     LdlIntro, LdlToneStep, LdlResults
  context/
    BleContext.native.tsx    real BLE provider (wraps the service singleton)
    BleContext.web.tsx       no-op stub (browsers have no BLE)
    ThemeContext.tsx         dark/light toggle
  services/
    BleConnectionManager.ts  the entire connection lifecycle (pure TS, no React)
  hooks/
    useLdlTone.ts            tone ramp state machine (safety-critical)
    useDebounce.ts           debounced slider sends (100 ms)
    useReducedMotion.ts      OS reduce-motion flag, used by all animation
  constants/
    ble.ts                   UUIDs, device name, timeouts, MTU
    dsp.ts                   f0/Q/atten ranges + MAX_BANDS (synced with firmware)
    safety.ts                hard output limits — see safety.md
    theme.ts                 palettes, fonts, radii (design-system.md)
  types/index.ts             FilterBand (UI) vs WireFilterBand (wire), payloads
```

## Key flows

### Slider → device
`Dashboard` keeps `FilterBand[]` (`{id, f0, q, attenDb}`) in local state. Any
change maps through `toWireBands()` → `{f0, Q, atten_db}` and goes out as a
debounced (100 ms) `MULTI_FILTER` via `sendPayload`.

### Connection lifecycle (`BleConnectionManager`)
Scan (15 s) → connect (10 s) → verify NUS → request MTU 247 (Android) →
connected. On unexpected drop: reconnect loop with exponential backoff
(1 s → 30 s), direct-by-id for 3 attempts then scan fallback; woken early by
adapter power-on or app foregrounding. Offline sends queue per-type
(latest-wins) and flush on reconnect. UI subscribes via `onStatusChange` /
`onQueueChange` / `onError`; only user-initiated errors alert.

### LDL test → dashboard bands
`LdlTest` walks 6 frequencies; `useLdlTone` ramps each tone (see safety.md);
results with LDL ≤ 70 dB become dampening bands (lower discomfort → deeper
cut), handed to `App.tsx` state, consumed once by `Dashboard` (replaces bands
and pushes to device immediately).

## Conventions

- **UI model vs wire model**: never send `FilterBand` raw — always
  `toWireBands()`. The wire uses uppercase `Q` and no `id`.
- Platform-split files (`.native.tsx` / `.web.tsx`) keep the web preview
  importable; web BLE is a stub that alerts on connect.
- All animation goes through `useReducedMotion`.
- Styles: co-located `StyleSheet.create`, themed via `useTheme()`; theme-aware
  screens build styles with a memoized `makeStyles(palette)`.

## Developing

- `npm run web` — browser preview at a centered 480 px phone frame
  (`PhoneFrame` in App.tsx; no-op on device). Typecheck: `npx tsc --noEmit`.
- No test suite yet (roadmap). The firmware parser has host-run unit tests in
  its own repo.
