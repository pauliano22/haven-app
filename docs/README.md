# Haven — project documentation

Haven (formerly *AcousticShield*) is a hearing companion system for people with
sound sensitivity / tinnitus pain triggers: a mobile app that remote-controls a
wearable DSP device, dampening the specific frequencies that hurt.

This folder is the canonical project memory. If you are picking this project up
cold (human or AI), read in this order:

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | The three repos, hardware targets, and how data flows end to end |
| [ble-protocol.md](ble-protocol.md) | The exact wire protocol between app and firmware — the contract both sides must honor |
| [app-guide.md](app-guide.md) | App code structure: screens, services, hooks, state flow |
| [design-system.md](design-system.md) | The "Lamplight Terminal" visual language — palette, type, motion, voice |
| [safety.md](safety.md) | Output-level safety invariants. **Read before touching LDL or tone code.** |
| [calibration.md](calibration.md) | How to measure commanded `level_db` against real dB SPL — the procedure that makes the safety numbers mean something. Empty Results section until done on hardware. |
| [clinical-basis.md](clinical-basis.md) | What the literature says about notching for tinnitus vs hyperacusis vs misophonia, and the product decisions that follow (taper, LDL history as a safety signal, N-of-1 outcome measurement, claims language). |
| [roadmap.md](roadmap.md) | What's done, what's next, and known loose ends |

## Quick facts

- **Repos** (submodules of [haven-workspace](https://github.com/pauliano22/haven-workspace)):
  `haven-app` (this one, Expo/React Native), `haven-zephyr-app` (nRF Connect
  SDK firmware), plus legacy prototypes `haven-legacy-teensy` and
  `haven-legacy-dsp-sandbox`.
- **Production hardware**: nRF5340 (BLE peripheral + I2C control master)
  driving an Analog Devices **ADAU1860** codec/DSP over I2C (address 0x64).
  The audio path — PDM mic → FastDSP biquads → DAC → speaker — lives
  entirely inside the codec; the nRF only writes coefficients. A stock
  OpenEarable 2.0 unit is this hardware.
- **BLE device name**: `Haven` — defined in `src/constants/ble.ts` here and
  `prj.conf` in the firmware. **They must always change together.**
- **Run the app**: `npm run web` for the browser preview (renders in a centered
  480px phone frame), `npm run android` / `npm run ios` for device builds.
  BLE only works on real devices; the web build uses a no-op BLE stub.
