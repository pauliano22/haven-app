# Design system — "Sanctuary · Evergreen"

**Status**: current design, implemented on branch `design/sanctuary` (Aug 2026).
Supersedes the earlier "Lamplight Terminal" system (a coding-terminal
aesthetic — pine-black, all-mono type, patch-bay hairline rules). That system
was reviewed and rejected: it read as engineering-console rather than
consumer-wellness, and it modeled the wrong part of its reference (Hermes
Agent's *dev-terminal UI* rather than the warmth of the Hermes *brand*). If
you find leftover Lamplight-Terminal styling anywhere, it's a bug — port it
to this system.

The brief: Haven is a wellness device, not a console. It should feel like a
premium, boutique product you trust — calm, warm, a genuine "haven" — not a
DSP remote control. Four full directions were mocked as static HTML before
picking this one (Evergreen dark / warm dark-plum "Nocturne" / botanical
"Ivory" light-first / friendly-minimal "Cloud") — see git history on
`design/sanctuary` for the rejected alternates if a future pass wants to
revisit.

## Structure — three tabs, not one scrolling page

The old single dashboard stacked seven cards (connection, visualizer, 3
sliders, bypass, LDL entry, TX monitor) — too much surface for a wellness app
where the user should get one calm answer per screen.

- **Home** — "Am I protected?" A breathing orb *is* the protection state
  (tap to pause/resume). Quick links to Tune and Hearing.
- **Tune** — "Shape what's softened." Visualizer, band chips, frequency /
  softening depth / width sliders. The engineering-facing TX monitor (raw
  JSON payload preview) was **removed from user-facing UI entirely** — it
  doesn't belong in a consumer product; if you need it back for debugging,
  add it behind a dev-only surface, not a normal screen.
- **Hearing** — the LDL guided test (unchanged flow, restyled).

A persistent bottom `TabBar` replaces the old back-button navigation.

## Palette (`src/constants/theme.ts`)

### Dark — Evergreen (primary)
| Token | Hex | Role |
| --- | --- | --- |
| Deep evergreen | `#111F1A` | background |
| — | `#1A2B25` | cards |
| Warm ivory | `#F4EEE1` | primary text — never pure white |
| — | `#9CADA0` | secondary text |
| Honey glow | `#E9A860` | THE accent: protected, connect, live values |
| Terracotta | `#D2604F` | **only** paused / disconnect / alert |

### Light — Ivory
Warm paper `#F6F1E6`, ink text `#27221A`, deep honey `#9C6410` accent (strong
enough for AA contrast on paper), brick `#B5473A` danger. Same brand, daylight.

**Color grammar unchanged from before**: one warm accent = active/flowing,
one alert color = paused/cut. Never introduce a third accent color.

## Typography

Two faces, clear roles:
- `SERIF_FONT` (Georgia) — display/editorial. Big readouts (`4.50 kHz`,
  `−20 dB`), screen titles ("Tune your sound"), the wordmark, the orb's state
  label ("Protected"). This carries the brand's warmth.
- `SANS_FONT` (system) — everything functional: body copy, buttons, labels,
  chips, safety text.
- `MONO_FONT` still exists in `theme.ts` but is **not used in any screen** —
  kept only as a constant for a possible future debug/dev surface.

## Signature element

The **orb** on Home — a soft honey sphere that breathes slowly (2.6 s cycle)
while protecting, sits still and dim when paused, and renders as a flat
outline when disconnected. It *is* the product's state, not a decoration —
tap it to pause/resume. This is the one thing Haven should be remembered by.

`SectionRule` (soft caption + right-aligned hint, no more hairline rule
graphics) is the secondary structural device on Tune/Hearing card headers.

## Shape & spacing

- Radius: cards `RADIUS = 20` (soft, pillowy), buttons/chips `RADIUS_SM = 12`,
  band chips are full pills.
- Generous padding, 1 px borders, no shadows beyond the orb's glow.
- Web preview still renders in a centered 480 px `PhoneFrame` — evaluation
  harness only.

## Motion — calm, sparse, always optional

All gated by `useReducedMotion`:
1. **Orb breath** — 2.6 s sine scale+glow cycle, *only while protecting*.
   Stillness itself communicates "paused."
2. Connected-status LED breath (`ConnectionBar`, 2.8 s — inherited from the
   prior system, still fitting).
3. Screen cross-fade (280 ms) on tab switch (`FadeIn`).
4. LDL meter glide between ramp steps.
Nothing flashes, bounces, or spins.

## Voice

Sentence case, plain and warm: "Protected" / "Paused" / "Not connected", "Tap
the circle to connect", "Find the sounds that hurt." No more uppercase mono
labels or terminal-style abbreviations. Buttons say what they do in plain
words ("Begin test", "Soften 3 sounds") rather than shouting commands.
