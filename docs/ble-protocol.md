# BLE wire protocol

The contract between `haven_app` and `nrf52_haven_fw`. Both sides must stay in
sync; the app-side constants live in `src/constants/{ble,dsp}.ts`, the
firmware side in `src/protocol.h` and `prj.conf`.

## Transport

- **Service**: Nordic UART Service (NUS), UUID `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`.
- **App → device**: write-with-response to the RX characteristic (`...0002`).
- **Device → app**: notifications on the TX characteristic (`...0003`) — one
  ack per processed line plus a few unsolicited events (see "Messages
  (device → app)" below). `BleConnectionManager` subscribes on connect.
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
Drives the calibration tone during the loudness-discomfort test, and the
short comparison/preview bursts in the pitch/loudness matching flow
("Match your sound"). **Safety-critical** — see [safety.md](safety.md).
Implemented firmware-side as of `haven-zephyr-app` commit `a8f38cf`:
`level_db` is clamped to 85 dB independently of this app's own cap, and a
keep-alive watchdog auto-stops the tone if `TONE_LEVEL` doesn't arrive
within 3s of the last one.

## Messages (device → app)

Implemented firmware-side in `src/ack.c` (haven-zephyr-app PR #12; contract
in its `docs/nus-acks.md`, app hand-off in `docs/app-side.md`), sent over
the TX characteristic. **Every line the app writes produces exactly one
ack**; a few **events** are unsolicited. Same framing as the other
direction: UTF-8 JSON, one object per line, `\n`-terminated — the app
reassembles on `\n` (`utils/deviceMessages.ts`, `LineBuffer`) and must not
assume one notification = one line. Every message is < 100 bytes.

Delivery is **best-effort**: if the firmware's TX pool is momentarily full
or the phone is already gone, the ack is dropped, never retried. The app
therefore treats acks as *confirmation*, never as the source of truth for
its own state — a missing ack changes nothing; only an explicit `ok:false`
does (see "What the app does with them").

### Acks — one per received line
| App sent | Device replies |
|---|---|
| `MULTI_FILTER` | `{"ack":"MULTI_FILTER","ok":true,"bands":N}` — N = bands actually applied (after the 5-band cap) |
| `BYPASS` | `{"ack":"BYPASS","ok":true,"enabled":B}` |
| `TONE_START` | `{"ack":"TONE_START","ok":true,"f0":F,"level_db":L}` — **the values the device applied after its own clamps**, as integers (a requested 120 dB comes back as 85) |
| `TONE_LEVEL` | `{"ack":"TONE_LEVEL","ok":true,"level_db":L}` |
| `TONE_STOP` | `{"ack":"TONE_STOP","ok":true}` |
| anything the firmware's parser rejects | `{"ack":"?","ok":false,"err":"parse"}` |
| a parsed command the codec driver refused | `{"ack":"<TYPE>","ok":false,"err":"dsp","code":<errno>}` — e.g. `-5` (EIO) when an I2C write to the ADAU1860 fails |

`TONE_*` acks say the command reached `tone_safety.c`; they say nothing
about whether a sound is audible (that is the codec route and the
not-yet-done acoustic calibration).

### Events — unsolicited
| Event | When | What the app does |
|---|---|---|
| `{"event":"boot","fw":"0.1.0-dev","fdsp_rate":192000,"dac_source":"fdsp"}` | immediately on BLE connect | Shown as `fw …` in `ConnectionBar`; stored on every LDL / match run (`LdlRun.fw`, `MatchRun.fw`). **`dac_source` is a safety gate**: `"fdsp"` is the product path with the limiter; `"dmic_direct"` is the no-DSP smoke-test build. Anything but an allow-listed value (`LIMITER_SAFE_DAC_SOURCES`, `constants/safety.ts`) disables both hearing tests — the Hearing tab explains why, and `useLdlTone`/`usePreviewTone` refuse to start regardless of UI. |
| `{"event":"tone_watchdog"}` | after `tone_safety.c` auto-silenced a tone because no `TONE_LEVEL` keep-alive arrived within 3 s | Treated as an **external stop**: the tone hooks clear their timers and go idle without sending `TONE_STOP` (the device is already silent), and the LDL step is reported `aborted` — no result is recorded, the run ends with a notice. Never "comfortable up to 85 dB". |

### What the app does with them (`src/utils/deviceMessages.ts` → `BleConnectionManager` → `BleContext`)
- `BleConnectionManager` subscribes to TX **before** its first write, so the
  boot event and the first ack are never missed; the subscription and any
  half-received line are dropped on disconnect and reset on (re)connect.
- Unparsable or unknown lines are ignored silently — forward-compatible: a
  newer firmware can add messages without breaking an older app.
- `FilterContext`: a `MULTI_FILTER`/`BYPASS` ack with `ok:false` rolls the
  UI back to the last band/bypass state the device *did* confirm, and Home
  shows a quiet "Couldn't apply that change". An `ok:true` ack shows a brief
  "Applied". No JSON, no command names, no retry loop.
- `useLdlTone`: a `TONE_START`/`TONE_LEVEL` ack whose `level_db` differs
  from what was sent moves the meter to the applied value (clamped to the
  app's own ceiling — an echo can lower the meter, never raise it past
  `MAX_TONE_LEVEL_DB`), and the ramp continues from there.
- Historical note: an earlier draft of this section (and haven-app PR #9)
  described a `{"type":"ACK","cmd":…}` / `{"type":"ERROR"}` shape from
  haven-zephyr-app PR #15. That PR was closed in favour of #12's richer
  format above; the app deliberately does **not** recognise the old shape.

## App-side delivery semantics

`BleConnectionManager` (see [app-guide.md](app-guide.md)) queues one pending
payload **per type** (latest wins), drains over a serialized write chain when
connected, and flushes the queue on reconnect. Consequences:

- Rapid slider moves collapse to the latest value — the device never replays a
  stale intermediate state.
- Tone payloads must never sit in the offline queue (a reconnect would replay
  a TONE_START). `useLdlTone` guarantees tones only start while connected and
  are killed on link loss.
