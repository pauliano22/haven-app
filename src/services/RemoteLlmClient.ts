/**
 * An `LlmClient` (see `llmSummary.ts`) that calls the reference relay in
 * `server/llm-relay/` instead of talking to Anthropic directly -- because a
 * client app must never hold a provider API key itself (it ships inside the
 * compiled bundle). See `docs/llm-summary.md` and
 * `server/llm-relay/README.md`.
 *
 * NOT USED ANYWHERE IN THIS APP YET. No screen, hook, or context constructs
 * this or passes it to `useHearingInsights()` -- every current call site
 * passes `null`, the fully-correct deterministic-only mode. Wiring this in
 * needs a real deployed relay URL, which needs someone to actually deploy
 * `server/llm-relay/` first (a real infrastructure and cost decision -- see
 * that directory's README). This class exists so that step is "point an
 * env var at a URL", not "write and test this from scratch under pressure."
 */
import { LlmClient } from './llmSummary';

export interface RemoteLlmClientOptions {
  /** The deployed relay's URL, e.g. https://haven-llm-relay.<you>.workers.dev/summarize */
  relayUrl: string;
  /** Must match the relay's RELAY_SHARED_SECRET, if it's configured with one. */
  sharedSecret?: string;
  /** Aborts the request after this long. A summary is a nice-to-have, not
   * something worth leaving a screen hanging on. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class RemoteLlmClient implements LlmClient {
  constructor(private readonly options: RemoteLlmClientOptions) {}

  async complete(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(this.options.relayUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.sharedSecret ? { 'x-relay-secret': this.options.sharedSecret } : {}),
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // generateSummary() (llmSummary.ts) catches any thrown error and
        // falls back to the deterministic summary -- a relay outage never
        // surfaces as a broken screen, just a plainer summary.
        throw new Error(`Relay responded ${response.status}`);
      }

      const data = (await response.json()) as { text?: string };
      return data.text ?? '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
