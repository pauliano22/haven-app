# Clinical basis — what Haven can and cannot claim to do

Haven's premise is simple: find the frequencies that hurt a person and take
them out of what they hear. Whether that *helps* depends on which condition
the person has, because "sound sensitivity" is at least three different
things with three different mechanisms and three different bodies of
evidence. This document lays that out so product decisions are made against
the literature rather than against intuition. Confidence labels: **strong**
= replicated / RCT-level; **mixed** = positive and null results both
published; **weak / none** = mechanism-level only.

Nothing here is medical advice, and none of it substitutes for an
audiologist. It is engineering due diligence.

## 1. Three conditions, three fits

### 1a. Tonal tinnitus — notch at the tinnitus frequency (fit: plausible, evidence **mixed**)

Mechanism: tinnitus is associated with hyperactive/hypersynchronous
auditory-cortex neurons tuned near the tinnitus pitch. Removing that
frequency band from what the person listens to is hypothesised to recruit
lateral inhibition from neighbouring frequencies and, over weeks, reduce the
tinnitus percept. This is "tailor-made notched music training" (TMNMT).

Evidence:
- Okamoto, Stracke, Wunderlich & Pantev, *PNAS* 2010 (107:1207): 12 months
  of self-chosen music notched one octave around the tinnitus frequency
  reduced subjective loudness and tinnitus-related cortical activity versus
  a placebo notch. Small trial (a few dozen participants). **Positive.**
- Stein et al., *BMC Neurology* 2016 (PMID 26987755): the CONSORT-standard
  RCT. N = 100, double-blind, 2 h/day for 3 months, placebo = music notched
  elsewhere. **No effect on the primary outcomes** (Tinnitus Handicap
  Questionnaire, VAS loudness/awareness/distress/handicap). Loudness was
  lower than control only at the one-month follow-up; distress trended the
  *wrong* way in the treatment group post-training (non-significant,
  disappeared at follow-up). The authors call it "one more step towards a
  final evaluation".

What this means for Haven: the mechanism is respectable and the
device is a natural way to deliver it, but the honest claim today is
*"experimental"*, not *"proven"*. Haven differs from every published study
in one large way — it notches the **entire acoustic environment all day**
rather than two hours of music. That could be more effective (more
exposure), less effective (notching everyday sound carries less energy at
the notch than music does), or have effects nobody has measured. It is a
hypothesis, and the product should be built to test it (see §3).

Design consequences:
- The LDL test finds *discomfort* frequencies, which is the right tool for
  hyperacusis (§1b). It is **not** a tinnitus-pitch match. **Implemented
  (merged 2026-09-12): `PitchMatchTest` / `src/utils/pitchMatch.ts` — adaptive
  two-alternative forced choice, bisection in log-frequency, 5–8 trials of
  1.4 s bursts at a fixed 55 dB nominal.** That is the right procedure; two
  review notes against the literature: (1) there is no octave-confusion
  check — tinnitus pitch matches are notoriously off by an octave, so add a
  final trial comparing the match against f/2 and 2f; (2) 55 dB is a fixed
  nominal level presented up to 8 kHz to people whose LDL may be *below*
  55 dB at exactly those frequencies — if an LDL history exists, cap the
  match level at (lowest measured LDL − 10 dB). Both are small changes to
  `pitchMatch.ts` / `constants/safety.ts`.
- Published TMNMT notches are wide (one octave around the tinnitus pitch,
  i.e. Q ≈ 1.4), not the narrow Q = 10 default in `dsp.ts`. The tinnitus
  use case wants a different preset.

### 1b. Hyperacusis / loudness intolerance — reduced LDLs (fit: **good for acute relief, contraindicated as chronic full-time attenuation**)

Mechanism: hyperacusis is best modelled as excess *central gain* — the
auditory system turning its amplifier up, often after cochlear damage or
sound deprivation. The Loudness Discomfort Level (LDL) test Haven already
implements is the standard measure.

Evidence that matters for design:
- Formby, Sherlock & Gold, *JASA* 2003 (114:55): two weeks of continuous
  earplug wear made normal-hearing listeners **more** sensitive to loudness
  (LDLs fell); two weeks of low-level background noise made them **less**
  sensitive (LDLs rose). **Strong** — this is the experimental basis for
  the sound-therapy approach to hyperacusis, and it has been replicated at
  the brainstem level (Munro & Blount 2009; and later work on acoustic
  deprivation and central gain).
- The clinical consensus that follows (e.g. the ASHA/AJA 2022 tutorial on
  sound therapy to reduce auditory gain): the treatment for hyperacusis is
  **enrichment and graduated exposure**, and habitual over-protection with
  earplugs is a documented way to make it worse.

What this means for Haven: a notch is far narrower than an earplug, so the
deprivation effect — if it exists for narrow bands — would be confined to
the notched frequencies. But nobody has measured whether all-day narrowband
attenuation lowers the LDL *at that frequency* over weeks. Given Formby, the
prudent prior is that it might.

Design consequences (these are the product-defining ones):
- Position dampening as **situational relief** — the dentist's drill, the
  restaurant, the commute — not a permanent full-time filter. The Home
  screen's protection orb should make "off" the resting state.
- Build a **taper**. **Implemented (merged 2026-09-12) as the opt-in
  tolerance-building plan (`useTolerancePlan`, −3 dB per week, every step
  user-confirmed, stop anytime).** That is the right shape — graduated,
  consented, reversible. One addition: re-run the LDL at the plan's
  frequency every few steps and pause the plan automatically if the LDL
  falls (next bullet).
- Treat the app's LDL history as a **safety signal**. The history exists
  (`LdlHistoryStore`, 20 runs, trend arrow) but nothing yet compares a run
  against the *active bands*: implement the check — if the LDL at a notched
  `f0` drops ≥ 10 dB from that user's baseline, surface it and offer to
  pause dampening there. This turns the calibration test into an outcome
  monitor and is the one piece of §1b's evidence the app doesn't yet act on.
- Surface wear time. A device that is "always on" without the user noticing
  is the failure mode Formby warns about.
- Never attenuate more than needed: default `atten_db` should derive from
  the LDL deficit, not sit at a fixed 20 dB.

### 1c. Misophonia — trigger *sounds*, not trigger *frequencies* (fit: **poor**; out of scope for the notch product)

Mechanism: misophonic reactions are to specific sounds identified by their
source and context — chewing, tapping, breathing — and are strongly
modulated by who is making them (one's own chewing doesn't trigger). Recent
work shows spectral cues contribute but action-identification and context
dominate; the neural signature is in salience/motor networks, not in a
frequency-specific cortical map.

What this means for Haven: a stationary notch filter cannot remove
"chewing". Claiming misophonia relief would be a mismatch between product
and mechanism. The `ml/` frequency-analysis tool in the firmware repo (find
the dominant narrowband component of a recording) is aimed at tonal
problem sounds — alarms, whines, feedback — which is the *hyperacusis*
use case, not misophonia. Keep misophonia out of the marketing until there
is a classifier-driven feature and evidence that it helps.

### 1d. Narrowband environmental triggers (fit: **best**)

The case Haven is genuinely built for: a person whose discomfort is
concentrated in an identifiable band — a specific alarm, a motor whine, the
4–6 kHz region that dominates dental and kitchen noise — and who wants to
stay in the room. Notching that band while passing speech through is
exactly what a 5-biquad hear-through device does well, and it is what the
Teensy prototype demonstrated. This is where the product story should
lead, with 1a and 1b as carefully-worded extensions.

## 2. The LDL test as a clinical procedure

Haven's ramp (30 dB start, +2 dB / 700 ms, stop on discomfort, 85 dB cap)
is a reasonable home-use design, but standard audiological LDL procedures
differ in ways worth adopting deliberately:

- **Instructions are the test.** Clinical LDL protocols specify the exact
  wording ("uncomfortably loud" vs "would not want to listen to this for
  long") because results shift by 10+ dB with phrasing. Pick a standard
  anchor set (e.g. the Contour Test's seven loudness categories, Cox et
  al. 1997) and keep the copy fixed across app versions so history is
  comparable.
- **Step size and repeats.** Clinical practice uses ascending runs in
  5 dB steps, repeated, and takes the median. Haven's 2 dB continuous ramp
  is gentler (good) but a single run is noisy; take two and show both.
- **Calibration precedes interpretation.** Every number the test produces
  is nominal until [calibration.md](calibration.md) is completed. Do not
  present LDL results as dB HL or dB SPL in the UI before then; present
  them as device units with a note.
- **Contraindications in-app.** Sudden hearing change, pain, ear infection,
  recent acoustic trauma: the test should not run. A short screen before
  the first test, with an "I have seen an audiologist about this" prompt,
  is cheap and responsible.

## 3. Build the product so it measures whether it works

Haven is in a position no published study has been in: continuous,
real-world, frequency-specific exposure control plus a daily measurement
channel. The excellent version of this product produces its own evidence.

- **Outcome instruments in the app.** For tinnitus users: a weekly VAS
  loudness/annoyance rating and the Tinnitus Handicap Inventory (25 items,
  free to use, validated) at baseline and monthly. For hyperacusis users:
  the LDL history (exists) plus a short intolerance questionnaire.
- **N-of-1 design by default.** Alternate active and bypass days (the
  device can log which it was) and compare ratings. This is the one design
  that gives an individual user a real answer about *their* benefit, and
  it is essentially free given the existing `BYPASS` command.
- **Log exposure.** Wear time, active bands, attenuation — locally, with
  consent, exportable. Without it, none of the above is interpretable.
- **Pre-register the hypothesis** before collecting from more than a few
  friends, and talk to a university IRB the moment the plan involves
  anyone outside the team. Cornell has both an audiology-adjacent
  hearing-science community and an IRB.

## 4. Claims and the regulatory line

Language decides whether Haven is a consumer electronics product or a
medical device. Rough map (US; not legal advice; confirm before shipping):

- "Tinnitus masker" is a defined FDA device type (21 CFR 874.3400). Any
  claim to *treat*, *reduce*, or *relieve* tinnitus is a medical-device
  claim.
- Hearing protection devices carry EPA noise-reduction labelling rules;
  Haven is an active device and should not be described as hearing
  protection in the regulatory sense (it does not have an NRR).
- The 2022 OTC hearing-aid rule covers *amplification* for hearing loss;
  Haven does not amplify and should not drift into that language.
- "Hearing companion", "reduce the frequencies that bother you", "you
  control what you hear" — the framing the app already uses — stays on the
  consumer side. Keep it there until there is data and counsel.

## 5. What to read next

- Okamoto C, Stracke H, Wunderlich R, Pantev C. *PNAS* 2010;107(3):1207–10.
- Stein A, et al. Clinical trial on tonal tinnitus with tailor-made notched
  music training. *BMC Neurol* 2016;16:38. PMID 26987755.
- Formby C, Sherlock LP, Gold SL. Adaptive plasticity of loudness induced
  by chronic attenuation and enhancement of the acoustic background.
  *J Acoust Soc Am* 2003;114(1):55–58.
- Munro KJ, Blount J. Adaptive plasticity in brainstem of adult listeners
  following earplug-induced deprivation. *J Acoust Soc Am* 2009;126:568.
- Cox RM, Alexander GC, Taylor IM, Gray GA. The Contour Test of loudness
  perception. *Ear Hear* 1997;18(5):388–400.
- Sound therapy to reduce auditory gain for hyperacusis and tinnitus
  (tutorial). *Am J Audiol* 2022.
- On misophonia triggers: Kumar et al., *Curr Biol* 2017 (brain basis);
  and the 2024 *Auditory Perception & Cognition* work on spectral vs
  action-identification cues.
