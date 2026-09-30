# Acoustic calibration — turning `level_db` into a real number

Every dB value the app or firmware handles today (`MAX_TONE_LEVEL_DB = 85`,
`LDL_START_LEVEL_DB = 30`, the 2 dB ramp step, the 70 dB sensitivity
threshold, the 40 dB cut cap) is a **commanded** value. None of them has yet
been measured against sound pressure at the eardrum. This document is the
procedure for closing that gap. It is written before the audio path has run
on hardware, so it describes what to do, not what was found; fill in the
"Results" section when the measurements exist and keep the history.

**Nothing in [safety.md](safety.md) should be relaxed on the basis of this
document until the Results section is populated and reviewed.**

## Why this is the top safety item

The LDL test deliberately walks a sound-sensitive person up toward their
discomfort level. The 85 dB ceiling is what makes that ethically acceptable
— 85 dB(A) is the level at which occupational-noise regulation starts
requiring hearing protection for an 8-hour exposure, and a few seconds at
85 dB is not injurious for a normal ear. But the ceiling only protects
anyone if "85" in `safety.ts` actually produces ≤ 85 dB SPL in the ear
canal. Between the number and the eardrum sit:

1. the FastDSP tone amplitude and the VOLUME / MIXER / LIMITER slot gains
   (Q5.27 values the firmware writes),
2. the codec's DAC volume register and headphone-amp mode
   (`DAC_VOL0`, `HP_LVMODE_*`, `PB_CTRL`),
3. the speaker's sensitivity (dB SPL per volt, into an ear-canal load),
4. the ear seal — an in-ear device's low-frequency output can swing by
   10–20 dB between a good seal and a leaky one,
5. the individual ear canal (a real eardrum sees a different SPL than a
   coupler does; standardised couplers exist precisely to make this
   repeatable).

Any one of these could put "85" at 70 dB SPL (test useless, results wrong)
or at 100 dB SPL (harmful). The same chain also determines what a "20 dB
cut" in a dampening band actually delivers to the ear.

## What to measure with

Choose one, in order of preference:

| Option | What it is | Approx. cost | Good enough for |
|---|---|---|---|
| **IEC 60318-4 occluded-ear simulator** (e.g. GRAS RA0045 / B&K 4157) with a calibrated measurement mic and pistonphone | The standard for in-ear/insert transducers; simulates the eardrum impedance | high (borrow: an audiology clinic or hearing-science lab will have one) | the numbers you'd put in a safety document |
| **MiniDSP EARS** or similar headphone measurement fixture with its calibration files | Consumer/prosumer fixture with pinnae and ear canals | ~$200 | relative measurements, seal effects, notch depth verification; absolute SPL to a few dB after applying its compensation |
| **Calibrated measurement mic + 2 cc coupler** (e.g. a hearing-aid test box coupler) | Coupler volume differs from a real occluded canal; adds a known correction | low if borrowed | first-pass sanity check that "85" isn't 100 |
| A phone SPL-meter app held to the earpiece | Uncalibrated, wrong acoustic load | free | **not** acceptable for anything that ends up in `safety.ts` — use only to catch gross errors before a real measurement |

Whatever is used, record its calibration status (pistonphone reading / cal
file date) with every measurement.

## Procedure

Do this on the real signal chain — same codec program, same DAC settings,
same speaker, same enclosure/eartip — that will ship. A change to any of
those invalidates the calibration.

### 1. Tone-level map (the LDL path)

For each `f0` in `LDL_TEST_FREQUENCIES_HZ` (1, 2, 3, 4, 6, 8 kHz):

1. Seat the earpiece in the simulator per its manual; record the seal
   (leak) condition.
2. Command `TONE_START` at `level_db = 30`, then `TONE_LEVEL` in 5 dB
   steps to 85, reading the simulator's SPL at each step. Also record the
   simulator reading with the tone stopped (noise floor / DAC idle noise).
3. Fit `SPL = a·level_db + b` per frequency. Expect slope ≈ 1 if the
   firmware's tone gain is truly in dB; a slope ≠ 1 means the
   `level_db → Q5.27 gain` conversion is wrong and must be fixed in
   firmware *first*, not compensated in a lookup table.
4. Repeat with a deliberately poor seal (eartip half-out) to bound the
   seal sensitivity per frequency.

Deliverable: a table `f0 → (offset_dB, slope, seal_spread_dB)`. The
firmware then applies the per-frequency offset so that a commanded 85
produces **≤ 85 dB SPL under the worst measured seal condition**, and the
app's copy tells the user what level they were actually exposed to.

### 2. Absolute ceiling check

With the calibration from step 1 applied: command 85 dB at every test
frequency, best and worst seal, and confirm the simulator never reads above
85 dB SPL (allow the measurement uncertainty, typically ±1–2 dB, on the
*conservative* side: aim for a measured ceiling of ~83). Then deliberately
send an out-of-range level (e.g. 120) and confirm both clamps hold — the
app's `clampToneLevel()` and the firmware's `PROTOCOL_TONE_LEVEL_MAX_DB`.
Kill the BLE link mid-tone and confirm the simulator goes silent within the
3 s watchdog.

### 3. Hear-through gain and notch depth (the dampening path)

Play pink noise into the simulator's environment (a speaker ~0.5 m away,
calibrated to a known level at the ear position with the earpiece removed).

1. Earpiece in, `BYPASS` on: measure the ear-simulator spectrum. The
   difference from the open-ear measurement is the device's **insertion
   gain** — ideally ~0 dB across 200–8000 Hz (transparent hear-through).
   Passive occlusion will show as low-frequency loss; note it.
2. Apply a single band (`f0 = 4500, Q = 10, atten_db = 20`) and measure
   again: verify the realised notch is centred within a few percent of
   `f0` and within ~1 dB of the commanded depth. Repeat at 200 Hz / Q 20
   (the numerically worst case per `tools/dsp/` in the firmware repo) and
   8000 Hz.
3. Apply five bands and confirm no interaction (cascade is linear; any
   deviation means clipping or a wrong coefficient write).
4. Measure mic→speaker latency: a click into the environment, cross-
   correlate open-ear vs in-ear simulator recordings. Target well under 1 ms
   for the codec-internal path; if it's several ms, audio is going through
   the nRF and the topology is wrong.

### 4. Record everything

Append to the Results section below: date, firmware commit, codec program
version, DAC register values, fixture and its calibration, eartip, raw
tables, fitted offsets, and who did it. Calibration without provenance is
worthless for a safety argument.

## What changes in the code once this exists

- `haven-zephyr-app`: a per-frequency `level_db → gain` table (or a fitted
  formula) in the tone path, and the limiter slot set so that no
  combination of tone + hear-through gain can exceed the measured ceiling
  even if every software clamp fails. The firmware limiter is the third,
  hardware-enforced layer; today it's only described.
- `haven-app`: `safety.md` gains a "Calibrated" section replacing "Not yet
  calibrated"; the LDL results copy states real dB SPL; the level meter
  scale reflects measured, not nominal, values.
- Both: any subsequent change to the codec program, DAC settings, speaker
  or eartip re-triggers steps 1–3.

## Results

*(empty — no measurement has been made yet)*
