/**
 * Turns the deterministic Insight[] list (see utils/insights.ts) into a
 * warmer, plain-language paragraph via an LLM -- and nothing more than
 * that. The model is only ever asked to rephrase facts it's given, never to
 * add new ones, and its output is checked for that before it's trusted.
 *
 * ── This is a prototype of the LLM half, not something wired to a real
 * API key anywhere in this app, and it shouldn't be until a backend exists.
 * A client app must never embed a provider API key directly -- it ships
 * inside the compiled bundle and can be extracted from it. The standard
 * pattern is a backend (even a small serverless function) that holds the
 * key, and the app calls that instead. See docs/llm-summary.md for the
 * fuller writeup and what a minimal backend for this would need to do.
 * `LlmClient` below is exactly the seam that backend call plugs into --
 * everything in this file is fully testable today with MockLlmClient,
 * with zero network access, and stays correct once a real client exists.
 */
import { describeInsight, Insight, numbersIn } from '../utils/insights';

export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

export type SummarySource = 'llm' | 'fallback';

export interface SummaryResult {
  text: string;
  source: SummarySource;
}

/** A safe, always-correct stand-in used whenever no LlmClient is configured,
 * or the real one fails or produces something that doesn't check out. */
export function fallbackSummary(insights: Insight[]): string {
  const lines = insights.map(describeInsight);
  return lines.length > 0 ? lines.join(' ') : 'No data yet.';
}

export function buildSummaryPrompt(insights: Insight[]): string {
  const facts = insights.map((i) => `- ${describeInsight(i)}`).join('\n');
  return [
    'You are rewriting a short hearing-test summary for someone to read in an app.',
    'Rewrite the facts below in one short, warm paragraph (2-4 sentences).',
    '',
    'Rules, all mandatory:',
    '- Use ONLY the facts given below. Do not add any number, frequency, date, or claim that is not already present.',
    '- Do not diagnose, suggest a cause, or recommend a medical action. This is not medical advice and must not read as any.',
    '- Do not use the words "tinnitus cause" or claim to know why anything is happening -- only describe what the numbers show.',
    '- Plain language, no jargon like "dB SPL" -- just say things like "you were comfortable" or "it took a louder sound to bother you".',
    '',
    'Facts:',
    facts,
  ].join('\n');
}

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

/** True only if every number in `text` matches some number the source
 * insights actually contain (small rounding tolerance for things like
 * "about 75 dB"). A single ungrounded number fails the whole summary --
 * better to fall back to the plain deterministic text than risk a
 * fabricated figure in a health-adjacent feature. */
export function isFaithful(text: string, insights: Insight[]): boolean {
  const allowed = insights.flatMap(numbersIn);
  const found = text.match(NUMBER_RE) ?? [];
  return found.every((token) => {
    const n = parseFloat(token);
    return allowed.some((a) => Math.abs(a - n) <= 1);
  });
}

/**
 * Produces a summary, preferring the LLM client when one is given and its
 * output passes the faithfulness check, and falling back to the plain
 * deterministic text otherwise -- including on any error, timeout, or an
 * empty/unparseable response. Never throws.
 */
export async function generateSummary(
  insights: Insight[],
  client: LlmClient | null,
): Promise<SummaryResult> {
  const fallback = fallbackSummary(insights);
  if (!client || insights.length === 0) {
    return { text: fallback, source: 'fallback' };
  }

  try {
    const raw = await client.complete(buildSummaryPrompt(insights));
    const trimmed = raw.trim();
    if (trimmed.length === 0) return { text: fallback, source: 'fallback' };
    if (!isFaithful(trimmed, insights)) return { text: fallback, source: 'fallback' };
    return { text: trimmed, source: 'llm' };
  } catch {
    return { text: fallback, source: 'fallback' };
  }
}
