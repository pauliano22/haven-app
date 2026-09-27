# Getting off Expo Go: the dev-client build

Expo Go can't run this app for real — `react-native-ble-plx` (the actual
Bluetooth library) is a native module, and Expo Go only ships a fixed set of
Expo's own native modules. This has been a known, open blocker (see
`roadmap.md`'s "Verify the redesign on a real iPhone via a dev-client
build"), and it's also the single thing that would unblock two of the
research ideas in `ML_RL_FEASIBILITY.md` (haven-zephyr-app): on-device sound
classification (needs `react-native-fast-tflite`, a native module) and any
future WASM-based audio work (React Native's own WASM support, real as of
RN 0.84+, needs the New Architecture — which this app already has; Expo SDK
55+ made it mandatory and non-optional).

One dev-client build unlocks all three. This doc covers what's done and
what's left, since the last step needs your Expo account.

## What's done (2026-09-27), verified locally, zero cost

- **`expo-dev-client` and `expo-system-ui` installed.** The latter wasn't a
  dependency before, and its absence was silently making `app.json`'s
  `userInterfaceStyle: "dark"` a no-op outside of Expo Go — a real gap that
  only shows up once you leave Expo Go, caught here by actually running a
  local prebuild rather than assuming the config was complete.
- **`npx expo install` also updated the `android`/`ios` npm scripts** from
  `expo start --android`/`--ios` (Expo Go) to `expo run:android`/`run:ios`
  (dev-client) — Expo's own convention when a dev client is present, not a
  manual edit.
- **`npx expo prebuild --platform android` run locally and verified clean**
  — no errors, no warnings, and the generated `AndroidManifest.xml` was
  checked directly: every Bluetooth/location permission from `app.json`'s
  `react-native-ble-plx` plugin config landed correctly. This means the
  Expo config-plugin setup this project already has is genuinely correct
  and ready — not just plausible on paper. (`android/` and `ios/` are
  gitignored and regenerated on demand — nothing from this prebuild is
  committed; this was a dry-run sanity check, not a permanent change to the
  repo structure.)
- **`eas.json` added**, with a `development` build profile
  (`developmentClient: true`, internal distribution — installs directly on
  a device, doesn't go through an app store).

## What's left — needs you, specifically your Expo account

Building the actual installable app needs either a Mac with Xcode (iOS) or
Android Studio (Android) locally, or Expo's own cloud build service (EAS
Build), which needs your Expo account and consumes your account's build
minutes (there's a free tier with real limits — queue times, a monthly
cap). I haven't run this and won't without you here, the same standing rule
as not placing the PCB order: it's your account and your resource to spend.

```bash
npx eas login                                   # your Expo account
npx eas build --profile development --platform android   # or --platform ios
```

That produces an installable build (an `.apk` link for Android, or a
TestFlight-ish internal install for iOS) — install it on your phone, then:

```bash
npx expo start --dev-client
```

connects to it the same way `expo start` connects to Expo Go, but now with
real native modules — real BLE, and the on-ramp for TFLite/WASM work later.

## What this unlocks, concretely

1. **Real hardware testing** of the actual BLE protocol (not just the DK
   bench service already testable on web) — the thing `roadmap.md` has
   flagged as unverified since the Sanctuary/Evergreen redesign.
2. **YAMNet on-device sound classification** (`ML_RL_FEASIBILITY.md`
   Tier 2) — `react-native-fast-tflite` has a real Expo config plugin
   (confirmed from its own docs), so it should slot in the same way
   `react-native-ble-plx` already has. **Real risk found, not just an
   unconfirmed gap**: a documented GitHub issue (mrousavy/react-native-fast-tflite#133)
   reports a build failure specifically with the New Architecture enabled
   on iOS, at v1.6.0 / RN 0.77.1. This app is on RN 0.85.3 where the New
   Architecture is mandatory (Expo SDK 55+ removed the option to disable
   it) — so this needs a direct check against a current library version
   before committing to it, not an assumption either way (the issue could
   be long fixed, or still open; wasn't confirmed either way this pass).
3. **Any future WASM-based audio experiment** — real as of RN 0.84+, and
   this app's Expo SDK (56) already mandates the New Architecture it needs.
