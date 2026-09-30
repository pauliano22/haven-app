# Haven LLM relay — reference implementation, NOT deployed

This is code, not infrastructure. Nothing here is deployed, no domain
points at it, no Cloudflare account or API key is wired to it. It exists so
that going live with `docs/llm-summary.md`'s LLM-rewrite feature is "deploy
this and set two env vars," not "design and test a backend from scratch."

## Why this needs to exist at all

A mobile app can never hold a real Anthropic API key — it ships inside the
compiled bundle and can be pulled back out of it. The standard fix is a
small backend that holds the key and that the app calls instead. This is
that backend, at the minimum size that does the job: one endpoint, one
job (take a prompt, ask Claude to rewrite it, return the text), no
database, no user accounts.

## What it does — and deliberately doesn't

- Validates the request (POST only, real JSON, a non-empty prompt under a
  size cap) before ever calling the model.
- Optionally checks a shared secret (`RELAY_SHARED_SECRET`) so a stranger
  who finds the relay's URL can't spend your Anthropic budget — a
  different, smaller concern than the API key itself, which they could
  never see either way.
- Calls Claude (`claude-opus-5`, per this codebase's model-choice
  convention) with exactly the prompt it was given, and returns the text.
- **Does not know or care that the prompt is a hearing-trend summary.**
  The safety property that matters for this feature — never trust a number
  the model adds that isn't in the source data — lives in the app's own
  `llmSummary.ts` (`isFaithful()`), which checks the relay's response
  *after* it comes back. This relay's only job is not leaking the API key.
  Keeping the safety check on the app side means it applies no matter what
  backend eventually serves `LlmClient`, not just this one.

## Deploying it for real (not done here)

This targets Cloudflare Workers — free tier covers this easily, no server
to manage, and its request/response types are the same `Request`/`Response`
Web APIs the code already uses. Any similar small serverless platform
(a single AWS Lambda behind a URL, a Vercel/Netlify function) would work
with minor adaptation.

```bash
npm install
npx wrangler login                              # your Cloudflare account
npx wrangler secret put ANTHROPIC_API_KEY        # paste your real key -- never commit it
npx wrangler secret put RELAY_SHARED_SECRET      # optional, a random string you make up
npx wrangler deploy src/worker.ts --name haven-llm-relay
```

(`wrangler` itself isn't in `package.json` yet — `npm install -D wrangler`
first if you go this route. Not added preemptively since nothing here is
deployed yet.)

That gives you a URL like `https://haven-llm-relay.<you>.workers.dev`. Then,
in the app:

```ts
import { RemoteLlmClient } from '../services/RemoteLlmClient';

const client = new RemoteLlmClient({
  relayUrl: 'https://haven-llm-relay.<you>.workers.dev',
  sharedSecret: '<the same random string>',
});

const { insights, summaryText } = useHearingInsights(client); // currently always called with null
```

That's the entire remaining wiring — everything else (the prompt, the
faithfulness check, the fallback) is already built and tested.

## Tests

```bash
npm install
npm test
```

13 tests against a fully mocked Anthropic client (`worker.test.ts`) — no
network access, no real API key, ever. Covers request validation, the
optional shared-secret check, the happy path, mapping a rate-limit error to
429 and any other Anthropic API error to 502 (never a raw 500), and that a
non-Anthropic error is never silently swallowed.

`RemoteLlmClient.test.ts` (the app-side caller) lives in the main app's
`src/services/` and runs under the app's own `npm test`.
