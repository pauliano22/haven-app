# App guide

Expo SDK 56 / React Native 0.85 / TypeScript. No navigation library — tab
state is a single `useState<Tab>` in `App.tsx`. No state library — React
context + one plain-TS service singleton.

## Layout

```
App.tsx                      tab state (home | tune | hearing), TabBar, PhoneFrame web wrapper
src/
  navigation.ts               Tab type
  screens/
    Home.tsx                 protection orb, quick links to Tune/Hearing
    Tune.tsx                 visualizer, band chips, frequency/softening/width sliders
    LdlTest.tsx               LDL test orchestrator (intro → testing → results) — the "Hearing" tab
  components/
    TabBar.tsx                persistent bottom tab bar
    ConnectionBar.tsx        status LED + connect/disconnect
    VisualizerCurve.tsx      SVG frequency-response curve
    SectionRule.tsx          soft section caption (design signature on Tune/Hearing cards)
    FadeIn.tsx                the app's ambient screen-transition animation
    ldl/                     LdlIntro, LdlToneStep, LdlResults
  context/
    BleContext.native.tsx    real BLE provider (wraps the service singleton)
    BleContext.web.tsx       no-op stub (browsers have no BLE)
    FilterContext.tsx        band state + all device sends — shared by Home/Tune/Hearing
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
`FilterContext` (`src/context/FilterContext.tsx`) owns `FilterBand[]`
(`{id, f0, q, attenDb}`) — previously local state inside a single Dashboard
screen, now shared so Home (protection toggle), Tune (editing), and Hearing
(applying LDL results) all see the same bands. Any change maps through
`toWireBands()` → `{f0, Q, atten_db}` and goes out as a debounced (100 ms)
`MULTI_FILTER` via `sendPayload`. Call `useFilters()` from any screen.

### Connection lifecycle (`BleConnectionManager`)
Scan (15 s) → connect (10 s) → verify NUS → request MTU 247 (Android) →
connected. On unexpected drop: reconnect loop with exponential backoff
(1 s → 30 s), direct-by-id for 3 attempts then scan fallback; woken early by
adapter power-on or app foregrounding. Offline sends queue per-type
(latest-wins) and flush on reconnect. UI subscribes via `onStatusChange` /
`onQueueChange` / `onError`; only user-initiated errors alert.

### Protection toggle (Home orb)
Tapping the orb calls `useFilters().setBypass(!bypass)` — `true` sends
`BYPASS`, `false` resends the current `MULTI_FILTER`. If not connected, the
tap instead calls `connect()`. The orb's visual state (breathing amber /
still dim / outline) is derived from `status` + `bypass`, not stored
separately — there is no risk of the orb lying about the real state.

### LDL test → bands
`LdlTest` walks 6 frequencies; `useLdlTone` ramps each tone (see safety.md);
results with LDL ≤ 70 dB become dampening bands (lower discomfort → deeper
cut) and go straight to `useFilters().applyBands()`, which replaces the band
set and pushes to the device immediately — no more prop-drilled callback
through `App.tsx`.

## Conventions

- **UI model vs wire model**: never send `FilterBand` raw — always
  `toWireBands()`. The wire uses uppercase `Q` and no `id`.
- Platform-split files (`.native.tsx` / `.web.tsx`) keep the web preview
  importable; web BLE is a stub that alerts on connect.
- All animation goes through `useReducedMotion`.
- Styles: co-located `StyleSheet.create`, themed via `useTheme()`; theme-aware
  screens build styles with a memoized `makeStyles(palette)`.
- `SERIF_FONT` for display/readouts, `SANS_FONT` for everything else — see
  design-system.md. Don't reach for `MONO_FONT` in screen UI.

## Developing

- `npm run web` — browser preview at a centered 480 px phone frame
  (`PhoneFrame` in App.tsx; no-op on device). Typecheck: `npx tsc --noEmit`.
- **Testing on a real iPhone**: this app cannot run in the plain **Expo Go**
  app — `react-native-ble-plx` is a native module (and the app declares BLE
  *peripheral* mode too), and Expo Go only bundles a fixed set of Expo SDK
  modules. You need a **development build** instead: either `npx expo run:ios`
  from a Mac with Xcode (installs a custom dev-client app on your phone via
  cable), or `eas build --profile development --platform ios` (cloud build,
  no Mac needed, but requires an Expo/EAS account and an Apple developer
  account for device install). Once that dev-client build is on your phone,
  `npm start` and scanning the QR code works like Expo Go normally would.
- No test suite yet (roadmap). The firmware parser has host-run unit tests in
  its own repo.
