# Plain-language hearing summary (LLM prototype)

A "frontier AI model" feature, in the literal sense: an optional step where
an LLM rewrites a person's LDL/match-your-sound trend data into a warmer,
more readable paragraph. It's built and tested end-to-end, but **not wired
to a real model anywhere in this app**, on purpose — see "Why there's no
live API call yet" below before adding one.

## The pipeline

1. **`utils/insights.ts`** — deterministic, real statistics computed from
   the same on-device history the app already stores (`LdlHistoryStore`,
   `MatchHistoryStore`). No network, no model. Every number here is a real
   count or dB/Hz value from the person's own saved runs: trend direction
   per frequency, a "persistent trigger" flag when a frequency is
   uncomfortable in at least half of recent tests, pitch drift and bother-
   score trend from the match history. This layer is useful and shippable
   entirely on its own, with zero AI involved.
2. **`services/llmSummary.ts`** — takes that same structured `Insight[]`
   list and, if an `LlmClient` is provided, asks it to rewrite the facts as
   a short paragraph. The prompt (`buildSummaryPrompt`) explicitly
   instructs the model not to add any number, claim, or diagnosis beyond
   what's given, and not to speculate about causes.
3. **The faithfulness check (`isFaithful`)** — after the model responds,
   every number in its output is checked against the actual numbers in the
   source insights (small rounding tolerance). If the model invents a
   number that isn't there — a fabricated percentage, a frequency that
   wasn't tested, anything — the whole response is discarded and the
   deterministic fallback (`fallbackSummary`, just `insights.map(describeInsight).join(' ')`)
   is used instead. This is the actual safety property that makes this
   honestly buildable for a health-adjacent feature: the LLM can only ever
   make the same facts *more readable*, never introduce new ones that
   silently pass through as if verified.
4. **`hooks/useHearingInsights.ts`** — loads history, computes insights,
   produces a summary. Called with no client (the current, permanent
   default until a backend exists), it's 100% the deterministic path —
   not a degraded stub, a fully correct mode on its own.

## Why there's no live API call yet

A mobile app must never embed a provider API key directly in its bundle —
it ships inside the compiled app and can be extracted from it by anyone
with modest reverse-engineering skill, at which point it's someone else's
free (or costly, on your account) LLM access. The standard, correct pattern
is a small backend (even a single serverless function) that holds the key
and that the app calls instead — the app never talks to the LLM provider
directly. This isn't a Haven-specific caution; it's the first thing any
guide to shipping an LLM feature in a client app says.

**What this means concretely**: `LlmClient` is the seam a real
implementation plugs into (`{ complete(prompt): Promise<string> }`). Making
this live for real needs, at minimum: a backend endpoint (holds the actual
API key, receives a prompt, returns text — a few dozen lines), and an
`LlmClient` implementation in the app that calls that endpoint instead of
any LLM provider directly. Neither exists yet. Building the backend piece
is a real, separate decision (it costs money to run and per API call, and
someone has to operate it) — not something to spin up unilaterally.

## Tests

`insights.test.ts` (16 tests): trend direction correctness (including the
null-means-"comfortable up to the safety cap" semantics), persistent-trigger
threshold logic, order-independence, and that pitch drift is deliberately
*not* labeled good/bad the way comfort or bother trends are.

`llmSummary.test.ts` (14 tests), the important ones: a faithful paraphrase
is accepted; a response with a fabricated percentage is rejected and falls
back; a response inventing an untested frequency is rejected; a thrown
error or empty response both fall back cleanly; no insights means the
client is never even called.

`useHearingInsights.test.ts` (4 tests): the full pipeline against mocked
history stores, including a `refresh()` reload.
