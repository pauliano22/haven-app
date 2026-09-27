import Anthropic from "@anthropic-ai/sdk";
import { Env, handleSummarize } from "./worker";

const ENV: Env = { ANTHROPIC_API_KEY: "test-key-not-real" };

function textResponse(text: string): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      service_tier: null,
    },
  } as Anthropic.Message;
}

function fakeClient(
  impl: (params: Anthropic.MessageCreateParams) => Promise<Anthropic.Message>,
) {
  return { messages: { create: impl } } as unknown as Pick<Anthropic, "messages">;
}

function req(body: unknown, opts: { method?: string; headers?: Record<string, string> } = {}) {
  return new Request("https://relay.example/summarize", {
    method: opts.method ?? "POST",
    headers: { "content-type": "application/json", ...opts.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("handleSummarize", () => {
  it("rejects non-POST requests", async () => {
    const res = await handleSummarize(req(undefined, { method: "GET" }), ENV);
    expect(res.status).toBe(405);
  });

  it("rejects invalid JSON bodies", async () => {
    const badReq = new Request("https://relay.example/summarize", {
      method: "POST",
      body: "{not json",
    });
    const res = await handleSummarize(badReq, ENV);
    expect(res.status).toBe(400);
  });

  it("rejects a missing prompt field", async () => {
    const res = await handleSummarize(req({}), ENV);
    expect(res.status).toBe(400);
  });

  it("rejects an empty prompt", async () => {
    const res = await handleSummarize(req({ prompt: "" }), ENV);
    expect(res.status).toBe(400);
  });

  it("rejects an oversized prompt", async () => {
    const res = await handleSummarize(req({ prompt: "x".repeat(8001) }), ENV);
    expect(res.status).toBe(400);
  });

  it("calls the model with the given prompt and returns its text", async () => {
    let seenParams: Anthropic.MessageCreateParams | null = null;
    const client = fakeClient(async (params) => {
      seenParams = params;
      return textResponse("A short, faithful rewrite.");
    });

    const res = await handleSummarize(req({ prompt: "Summarize: X went from 60 to 75." }), ENV, () => client);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string };
    expect(json.text).toBe("A short, faithful rewrite.");
    expect(seenParams).not.toBeNull();
    expect(seenParams!.model).toBe("claude-opus-5");
    expect(seenParams!.messages).toEqual([
      { role: "user", content: "Summarize: X went from 60 to 75." },
    ]);
  });

  it("returns empty text if the model responds with no text block", async () => {
    const client = fakeClient(async () => ({
      ...textResponse(""),
      content: [],
    }));
    const res = await handleSummarize(req({ prompt: "hello" }), ENV, () => client);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string };
    expect(json.text).toBe("");
  });

  it("maps a rate-limit error to 429", async () => {
    const client = fakeClient(async () => {
      throw new Anthropic.RateLimitError(
        429,
        { type: "error", error: { type: "rate_limit_error", message: "slow down" } },
        "slow down",
        new Headers(),
      );
    });
    const res = await handleSummarize(req({ prompt: "hello" }), ENV, () => client);
    expect(res.status).toBe(429);
  });

  it("maps any other Anthropic API error to 502, not a raw 500", async () => {
    const client = fakeClient(async () => {
      throw new Anthropic.APIError(
        500,
        { type: "error", error: { type: "api_error", message: "upstream boom" } },
        "upstream boom",
        new Headers(),
      );
    });
    const res = await handleSummarize(req({ prompt: "hello" }), ENV, () => client);
    expect(res.status).toBe(502);
  });

  it("does not swallow a non-Anthropic error", async () => {
    const client = fakeClient(async () => {
      throw new Error("something unrelated broke");
    });
    await expect(handleSummarize(req({ prompt: "hello" }), ENV, () => client)).rejects.toThrow(
      "something unrelated broke",
    );
  });

  describe("with RELAY_SHARED_SECRET configured", () => {
    const secureEnv: Env = { ...ENV, RELAY_SHARED_SECRET: "shh" };
    const client = fakeClient(async () => textResponse("ok"));

    it("rejects a request with no secret header", async () => {
      const res = await handleSummarize(req({ prompt: "hello" }), secureEnv, () => client);
      expect(res.status).toBe(401);
    });

    it("rejects a request with the wrong secret", async () => {
      const res = await handleSummarize(
        req({ prompt: "hello" }, { headers: { "x-relay-secret": "wrong" } }),
        secureEnv,
        () => client,
      );
      expect(res.status).toBe(401);
    });

    it("allows a request with the correct secret", async () => {
      const res = await handleSummarize(
        req({ prompt: "hello" }, { headers: { "x-relay-secret": "shh" } }),
        secureEnv,
        () => client,
      );
      expect(res.status).toBe(200);
    });
  });
});
