/**
 * Reference implementation of the backend `docs/llm-summary.md` says the
 * plain-language trend summary needs before it can go live -- NOT deployed
 * anywhere, not wired to any real key. See this directory's README.md.
 *
 * A Cloudflare Worker (works unmodified as the entry point for one -- see
 * README.md for why that platform) that holds the real Anthropic API key
 * server-side and does exactly one thing: take a prompt, ask Claude to
 * rewrite it, return the text. The app's `LlmClient` interface
 * (`src/services/llmSummary.ts`) is exactly this shape already --
 * `RemoteLlmClient.ts` in this same repo shows the app-side call to this
 * endpoint, also not wired into anything live.
 *
 * This relay does not know or care that the prompt is a hearing-trend
 * summary -- it's a generic "rewrite this text" endpoint, which is
 * deliberate: the safety property (never trust an added number) lives in
 * `llmSummary.ts`'s `isFaithful()` check on the app side, not here. This
 * file's only job is not leaking the API key.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Optional shared secret between the app and this relay -- a separate
   * concern from the Anthropic key: this stops randoms from spending your
   * Anthropic budget by finding the relay's URL, even though they could
   * never see the key itself either way. Not set = no check (fine for
   * local testing, not for anything actually deployed). */
  RELAY_SHARED_SECRET?: string;
}

export interface SummarizeRequestBody {
  prompt: string;
}

/** Generous cap for this feature's prompt size (a handful of one-sentence
 * facts) -- rejects an oversized/abusive body cheaply, before ever calling
 * the model. */
const MAX_PROMPT_CHARS = 8000;

const MODEL = "claude-opus-5";
/** A short rewrite of a handful of given facts is not worth high effort or
 * a large budget -- see the claude-api skill's guidance that classification-
 * and chat-shaped tasks do well at low effort. */
const MAX_TOKENS = 512;

type MessagesClient = Pick<Anthropic, "messages">;

function defaultClientFactory(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey });
}

/**
 * Handles one relay request. `makeClient` is injectable so tests can run
 * with zero network access and no real API key -- see worker.test.ts.
 */
export async function handleSummarize(
  request: Request,
  env: Env,
  makeClient: (apiKey: string) => MessagesClient = defaultClientFactory,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (env.RELAY_SHARED_SECRET) {
    const provided = request.headers.get("x-relay-secret");
    if (provided !== env.RELAY_SHARED_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: SummarizeRequestBody;
  try {
    body = (await request.json()) as SummarizeRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (typeof body.prompt !== "string" || body.prompt.length === 0) {
    return new Response("Missing 'prompt'", { status: 400 });
  }
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    return new Response("Prompt too long", { status: 400 });
  }

  const client = makeClient(env.ANTHROPIC_API_KEY);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // A low-effort setting would fit this task well (a short rewrite of a
      // handful of given facts), but the installed SDK (0.70.1) doesn't
      // expose output_config/effort in its types yet -- add it once a
      // version that does is in use, rather than fighting the installed
      // types with an `as any`.
      messages: [{ role: "user", content: body.prompt }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return Response.json({ text: textBlock?.text ?? "" });
  } catch (error) {
    // Most-specific-first, per the claude-api skill's own guidance -- never
    // collapse this into one broad catch.
    if (error instanceof Anthropic.RateLimitError) {
      return new Response("Rate limited, try again shortly", { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return new Response(`Upstream error: ${error.message}`, { status: 502 });
    }
    throw error;
  }
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleSummarize(request, env),
};
