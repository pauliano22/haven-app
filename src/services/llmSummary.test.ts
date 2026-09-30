import { Insight } from '../utils/insights';
import { buildSummaryPrompt, fallbackSummary, generateSummary, isFaithful, LlmClient } from './llmSummary';

const SAMPLE_INSIGHTS: Insight[] = [
  { type: 'ldl_trend', f0: 4000, direction: 'improving', firstDb: 60, lastDb: 75, runCount: 2 },
  { type: 'persistent_trigger', f0: 6000, occurrences: 3, totalRuns: 4 },
];

class MockLlmClient implements LlmClient {
  constructor(private response: string | Error) {}
  async complete(): Promise<string> {
    if (this.response instanceof Error) throw this.response;
    return this.response;
  }
}

describe('isFaithful', () => {
  it('accepts a paraphrase that only repeats given numbers', () => {
    const text = 'At 4000 Hz, it took a louder sound (about 75 dB, up from 60) to bother you across 2 tests.';
    expect(isFaithful(text, SAMPLE_INSIGHTS)).toBe(true);
  });

  it('accepts small rounding differences', () => {
    const text = 'Around 76 dB now, versus 61 before, at 4000 Hz.';
    expect(isFaithful(text, SAMPLE_INSIGHTS)).toBe(true);
  });

  it('rejects a fabricated number nowhere in the source insights', () => {
    const text = 'At 4000 Hz your threshold improved to 75 dB, and your risk of hearing loss dropped by 40%.';
    expect(isFaithful(text, SAMPLE_INSIGHTS)).toBe(false);
  });

  it('rejects a plausible-sounding but invented frequency', () => {
    const text = 'Your comfort at 5000 Hz has been improving lately.';
    expect(isFaithful(text, SAMPLE_INSIGHTS)).toBe(false);
  });

  it('accepts text with no numbers at all', () => {
    expect(isFaithful('Things have been looking better recently.', SAMPLE_INSIGHTS)).toBe(true);
  });
});

describe('buildSummaryPrompt', () => {
  it('includes every fact and the anti-hallucination / non-diagnostic rules', () => {
    const prompt = buildSummaryPrompt(SAMPLE_INSIGHTS);
    expect(prompt).toContain('4000 Hz');
    expect(prompt).toContain('6000 Hz');
    expect(prompt.toLowerCase()).toContain('do not add any number');
    expect(prompt.toLowerCase()).toContain('not medical advice');
  });
});

describe('fallbackSummary', () => {
  it('joins every insight\'s plain description', () => {
    const text = fallbackSummary(SAMPLE_INSIGHTS);
    expect(text).toContain('4000 Hz');
    expect(text).toContain('6000 Hz');
  });

  it('has a sensible message for no insights', () => {
    expect(fallbackSummary([])).toBe('No data yet.');
  });
});

describe('generateSummary', () => {
  it('uses the fallback directly when no client is configured', async () => {
    const result = await generateSummary(SAMPLE_INSIGHTS, null);
    expect(result.source).toBe('fallback');
    expect(result.text).toBe(fallbackSummary(SAMPLE_INSIGHTS));
  });

  it('uses the fallback when there are no insights, without calling the client', async () => {
    const client = new MockLlmClient('should never be seen');
    const spy = jest.spyOn(client, 'complete');
    const result = await generateSummary([], client);
    expect(result.source).toBe('fallback');
    expect(spy).not.toHaveBeenCalled();
  });

  it('accepts a faithful LLM response', async () => {
    const client = new MockLlmClient(
      'At 4000 Hz, it took a louder sound (75 dB, up from 60) to bother you across 2 tests.',
    );
    const result = await generateSummary(SAMPLE_INSIGHTS, client);
    expect(result.source).toBe('llm');
    expect(result.text).toContain('4000 Hz');
  });

  it('falls back when the LLM response contains a fabricated number', async () => {
    const client = new MockLlmClient('Your threshold improved to 75 dB and your hearing loss risk dropped by 40%.');
    const result = await generateSummary(SAMPLE_INSIGHTS, client);
    expect(result.source).toBe('fallback');
    expect(result.text).toBe(fallbackSummary(SAMPLE_INSIGHTS));
  });

  it('falls back when the client throws', async () => {
    const client = new MockLlmClient(new Error('network error'));
    const result = await generateSummary(SAMPLE_INSIGHTS, client);
    expect(result.source).toBe('fallback');
  });

  it('falls back on an empty response', async () => {
    const client = new MockLlmClient('   ');
    const result = await generateSummary(SAMPLE_INSIGHTS, client);
    expect(result.source).toBe('fallback');
  });
});
