# Design system — "Lamplight Terminal"

The brief (Aug 2026): move away from the cyan "sterile medical equipment" look
to a premium, boutique **bespoke terminal**. References the user cares about:
the dark **Hermes Agent WebUI** theme (pine-black `#041c1c`, cream `#ffe6cb`,
amber glow) and their personal website (cream paper, typewriter mono, one red
accent). The synthesis: *a hi-fi instrument panel lit by a warm lamp* — dark
but warm, never clinical. The product should feel calm, trustworthy, a safe
"haven".

## Palette (`src/constants/theme.ts`)

### Dark — Lamplight Terminal (primary)
| Token | Hex | Role |
| --- | --- | --- |
| Pine Black | `#081714` | background |
| Deep Moss | `#0F231F` | cards / modules |
| Lamplight Cream | `#F2E8D5` | primary text — **never pure white** |
| Sage Ash | `#8CA096` | secondary text |
| Signal Amber | `#FFBD54` | THE accent: live values, connect, active |
| Vermilion | `#E0584D` | **only** stop / bypass / disconnect |

### Light — Daylight Paper
Derived from the user's website: cream `#F5EEDC` paper, ink text `#241E12`,
burnt amber `#8C5E0A` accent, brick `#B23A2E` danger. Same instrument, daylight.

**Color grammar**: amber = signal flowing; vermilion = signal cut. Do not use
vermilion decoratively, and do not introduce a third accent.

## Typography

All-mono identity (`MONO_FONT` = Menlo/system mono — deliberately no webfont
dependency). Hierarchy comes from weight, tracking, and case, not family:
- Readouts: mono 34–48, weight 700, negative tracking, amber.
- Labels/eyebrows: mono 10–12, weight 700, letterSpacing 1.5–3, uppercase.
- `SANS_FONT` is reserved for instructional paragraphs (LDL copy) only.

## Signature element

`SectionRule` — a mono label engraved in a hairline rule with an optional dim
right-aligned hint (`── TARGET FREQUENCY ───────── pain trigger`), like
patch-bay engraving. Every card header uses it, on every screen. If you add a
card, use it too.

Secondary marks: the `HAVEN▍` wordmark with breathing amber cursor; the `>`
prompt in the TX monitor; the square (not round) status LED.

## Shape & spacing

- Radius: cards `RADIUS = 6`, chips/buttons `RADIUS_SM = 3`. No pill shapes.
- Card padding 18, 1 px borders, no shadows, no gradients, no noise overlays.
- Web preview renders in a centered 480 px column (`PhoneFrame`) — evaluation
  harness only; the design targets phones, touch targets ≥ 44 pt.

## Motion — calm, sparse, always optional

Exactly three ambient animations, all gated by `useReducedMotion`:
1. Wordmark cursor blink — slow sine breath (`Blink`).
2. Connected LED breath — 2.8 s cycle (`ConnectionBar`) — a heartbeat, not an alert.
3. Screen cross-fade — 280 ms on dashboard↔LDL switch (`FadeIn`).
Plus one functional ease: the LDL meter glides between ramp steps.
Do not add motion beyond this register; nothing should ever flash or bounce.

## Voice

Lowercase mono comments for flavor (`// quiet, tuned to you`), plain sentence
case for instructions, active verbs on buttons ("BEGIN TEST", "STOP"). Copy
should reassure by being specific, never by being cute.
