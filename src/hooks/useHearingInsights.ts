import { useCallback, useEffect, useState } from 'react';
import { getLdlHistory } from '../services/LdlHistoryStore';
import { getMatchHistory } from '../services/MatchHistoryStore';
import { generateSummary, LlmClient, SummarySource } from '../services/llmSummary';
import { computeInsights, Insight } from '../utils/insights';

export interface HearingInsightsState {
  loading: boolean;
  insights: Insight[];
  summaryText: string;
  summarySource: SummarySource | null;
  refresh: () => void;
}

/**
 * Loads the on-device LDL/match history, computes structured insights, and
 * produces a plain-language summary of them.
 *
 * `llmClient` is optional and deliberately not provided anywhere in this
 * app yet -- see docs/llm-summary.md for why (no backend exists to hold an
 * API key safely). Passing null (the default) is not a stub or a
 * placeholder to fill in later; it's a fully correct, permanent mode: no
 * insights are ever lost or degraded, `summaryText` is just the plain
 * deterministic version instead of an LLM's paraphrase of the exact same
 * facts.
 */
export function useHearingInsights(llmClient: LlmClient | null = null): HearingInsightsState {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [summarySource, setSummarySource] = useState<SummarySource | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [ldlRuns, matchRuns] = await Promise.all([getLdlHistory(), getMatchHistory()]);
      const computed = computeInsights(ldlRuns, matchRuns);
      const summary = await generateSummary(computed, llmClient);
      if (cancelled) return;
      setInsights(computed);
      setSummaryText(summary.text);
      setSummarySource(summary.source);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmClient, reloadToken]);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  return { loading, insights, summaryText, summarySource, refresh };
}
