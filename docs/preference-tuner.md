# Preference-guided tuner

An opt-in alternative to manually dragging the Softening/Width sliders on
Tune: a short series of A/B comparisons ("which sounds better?") that
converges on a depth (`attenDb`) and width (`Q`) for the currently selected
band. Reachable from Tune's "Help me find a better setting →" link, only
while connected and not bypassed.

## What it is, and isn't

**Precedent**: commercial hearing aids (Widex's SoundSense Learn) use
repeated A/B preference comparisons to converge on a personal setting across
a large parameter space in roughly a dozen comparisons, instead of manual
guessing or exhaustive search. This feature is a much smaller, from-scratch
version of that idea.

**Not a learned model.** No training data, no pretraining, nothing persists
across sessions or users. Each search starts fresh from the band's current
values and only ever uses that one session's own answers. See
`ML_RL_FEASIBILITY.md` in `haven-zephyr-app` for the fuller reasoning on
what "ML/RL for Haven" can and can't honestly mean.

**Never touches frequency.** *Which* frequency to soften is decided by the
LDL test, the pitch-match flow, or manual tuning — this search only ever
adjusts how much (`attenDb`) and how narrow (`Q`) the already-selected band
is. It also never touches `TONE_*`/LDL code at all: every value it applies
goes through the exact same `updateBand()` path (see `FilterContext.tsx`)
manual slider drags already use, so it inherits the same existing clamps and
carries no new safety surface.

## How it works

`src/utils/preferenceSearch.ts` holds the core algorithm: given a short,
explicit list of candidate values for one dimension, it presents two
candidates, narrows a bracket toward whichever the user prefers (a
ternary-search-style shrink), and repeats until the bracket collapses to one
value. `src/hooks/useBandTuner.ts` runs this twice in sequence — softening
depth first, then width — applying each candidate live so the user hears
real feedback, not a synthetic preview tone.

**Working assumption, stated plainly**: preference over each dimension is
assumed to have a single "sweet spot" (unimodal) — for example, that both
too little and too much softening are worse than some middle value. That's
reasonable for a depth/width control but isn't guaranteed for every person.
If it's wrong for someone, the search can settle on a locally-preferred
point that isn't their true favorite; the manual sliders remain available
immediately afterward regardless, and "Cancel — keep what I had" restores
the pre-search values at any point.

## Candidate grids

Hand-picked, not derived from any dataset:

- Depth: `[3, 9, 15, 21, 28, 34, 40]` dB (spans `ATTEN_MIN_DB`–`ATTEN_MAX_DB`)
- Width: `[1, 3, 6, 10, 14, 17, 20]` (spans `Q_MIN`–`Q_MAX`)

`useBandTuner.ts` asserts these stay within `constants/dsp.ts`'s real
ranges at module load, so the two can't silently drift apart.

## Tests

`preferenceSearch.test.ts` verifies the algorithm directly: it always
terminates (bounded step count under every fixed sequence of answers,
including an indifferent "same" every time), and — the property that
actually matters — it converges to the true closest candidate to a
simulated target preference, for both the depth and width grids. A real bug
was caught here during development: an earlier version could stop one
comparison too early and silently keep the wrong candidate when the true
answer sat at the edge of the range. Don't loosen `isDone()`'s definition
(the bracket must fully collapse to a single candidate) without re-deriving
why that mattered.

`useBandTuner.test.ts` verifies the orchestration: starting applies the
first candidate live, `playOption` re-auditions without advancing the
search, running both phases to completion never leaves values outside the
real ranges, `f0` is never touched, and `cancel()` restores the exact
pre-search values.
