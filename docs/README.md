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
| [roadmap.md](roadmap.md) | What's done, what's next, and known loose ends |

## Quick facts

- **Repos** (siblings in `~/projects/active/`): `haven_app` (this one, Expo/React Native),
  `nrf52_haven_fw` (nRF Connect SDK firmware), plus legacy prototypes
  `teensy_hearing_shield` and `tinnitus_dsp`.
- **Production hardware**: nRF52 (BLE peripheral + control master) driving an
  Analog Devices **ADAU1860** audio DSP over I2C/SPI.
- **BLE device name**: `Haven` — defined in `src/constants/ble.ts` here and
  `prj.conf` in the firmware. **They must always change together.**
- **Run the app**: `npm run web` for the browser preview (renders in a centered
  480px phone frame), `npm run android` / `npm run ios` for device builds.
  BLE only works on real devices; the web build uses a no-op BLE stub.
