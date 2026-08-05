# BLE wire protocol

The contract between `haven_app` and `nrf52_haven_fw`. Both sides must stay in
sync; the app-side constants live in `src/constants/{ble,dsp}.ts`, the
firmware side in `src/protocol.h` and `prj.conf`.

## Transport

- **Service**: Nordic UART Service (NUS), UUID `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`.
- **App → device**: write-with-response to the RX characteristic (`...0002`).
- **Device → app**: TX characteristic (`...0003`) is defined but **not yet
  used** — the app never subscribes; acks are a roadmap item.
- **Device name**: advertises as `Haven`. The app scans by exact name match.
  Change `DEVICE_NAME` (app) and `CONFIG_BT_DEVICE_NAME` (firmware) together.
- **MTU**: app requests 247 on Android so a full 5-band payload fits one write.
- **Framing**: every message is UTF-8 JSON terminated by `\n`. The firmware
  buffers until newline (512-byte cap) and parses the complete line; a
  truncated/oversized line fails parsing gracefully and is dropped.

## Messages (app → device)

### MULTI_FILTER — replace all active bands
```json
{"type":"MULTI_FILTER","bands":[{"f0":4500,"Q":10,"atten_db":20}]}
```
- 1–5 bands (`MAX_BANDS = 5` on both sides; extra bands truncated on-device).
- `f0` Hz, clamped 200–8000. `Q` clamped 1–20. Uppercase `Q` — historical
  gotcha: the app once sent lowercase `q` and it silently failed.
- `atten_db` — positive dB of reduction, clamped 0–40. **Optional**: omitted
  means full notch. A value ≥ 40 also degenerates to a pure notch; below 40
  the firmware computes a peaking-cut EQ of that depth.
- Receiving MULTI_FILTER clears bypass on the device.

### BYPASS
```json
{"type":"BYPASS","enabled":true}
```
`true` = raw pass-through. The app un-bypasses by sending a fresh MULTI_FILTER.

### Tone control (LDL test) — TONE_START / TONE_LEVEL / TONE_STOP
```json
{"type":"TONE_START","f0":4000,"level_db":30}
{"type":"TONE_LEVEL","level_db":42}
{"type":"TONE_STOP"}
```
Drives the calibration tone during the loudness-discomfort test.
**Safety-critical** — see [safety.md](safety.md). The firmware does not
implement these yet (roadmap): when it does, it must enforce its own level
ceiling and an auto-stop watchdog independent of the app.

## App-side delivery semantics

`BleConnectionManager` (see [app-guide.md](app-guide.md)) queues one pending
payload **per type** (latest wins), drains over a serialized write chain when
connected, and flushes the queue on reconnect. Consequences:

- Rapid slider moves collapse to the latest value — the device never replays a
  stale intermediate state.
- Tone payloads must never sit in the offline queue (a reconnect would replay
  a TONE_START). `useLdlTone` guarantees tones only start while connected and
  are killed on link loss.
