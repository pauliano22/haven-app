import { act, renderHook, waitFor } from '@testing-library/react-native';
import { LdlRun, MatchRun } from '../types';
import { LlmClient } from '../services/llmSummary';
import { useHearingInsights } from './useHearingInsights';

let mockLdlHistory: LdlRun[] = [];
let mockMatchHistory: MatchRun[] = [];

jest.mock('../services/LdlHistoryStore', () => ({
  getLdlHistory: () => Promise.resolve(mockLdlHistory),
}));
jest.mock('../services/MatchHistoryStore', () => ({
  getMatchHistory: () => Promise.resolve(mockMatchHistory),
}));

describe('useHearingInsights', () => {
  beforeEach(() => {
    mockLdlHistory = [];
    mockMatchHistory = [];
  });

  it('starts loading, then settles with insufficient-data insights and a fallback summary when there is no history', async () => {
    const { result } = renderHook(() => useHearingInsights());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.insights).toEqual([
      { type: 'insufficient_data', area: 'ldl' },
      { type: 'insufficient_data', area: 'match' },
    ]);
    expect(result.current.summarySource).toBe('fallback');
    expect(result.current.summaryText.length).toBeGreaterThan(0);
  });

  it('computes real insights from real stored history', async () => {
    mockLdlHistory = [
      { timestamp: 1000, results: [{ f0: 4000, ldlDb: 60 }] },
      { timestamp: 2000, results: [{ f0: 4000, ldlDb: 75 }] },
    ];

    const { result } = renderHook(() => useHearingInsights());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.insights).toContainEqual(
      expect.objectContaining({ type: 'ldl_trend', f0: 4000, direction: 'improving' }),
    );
  });

  it('uses a faithful LLM client when one is provided', async () => {
    mockLdlHistory = [
      { timestamp: 1000, results: [{ f0: 4000, ldlDb: 60 }] },
      { timestamp: 2000, results: [{ f0: 4000, ldlDb: 75 }] },
    ];
    const client: LlmClient = {
      complete: async () => 'At 4000 Hz your comfort went from 60 to 75 dB across 2 tests.',
    };

    const { result } = renderHook(() => useHearingInsights(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summarySource).toBe('llm');
  });

  it('refresh() reloads from the stores', async () => {
    const { result } = renderHook(() => useHearingInsights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insights[0]).toEqual({ type: 'insufficient_data', area: 'ldl' });

    mockLdlHistory = [
      { timestamp: 1000, results: [{ f0: 4000, ldlDb: 60 }] },
      { timestamp: 2000, results: [{ f0: 4000, ldlDb: 75 }] },
    ];
    act(() => result.current.refresh());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insights.some((i) => i.type === 'ldl_trend')).toBe(true);
  });
});
