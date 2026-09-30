/**
 * Turns the LDL and "match your sound" history already stored on-device
 * (LdlHistoryStore, MatchHistoryStore) into a short list of structured,
 * numeric findings -- trend direction, persistent triggers, drift over
 * time. Every field here is a real number or count computed from the
 * user's own saved runs. No network call, no model, no training data.
 *
 * This is the deterministic layer a plain-language summary (see
 * llmSummary.ts) is built on top of -- and the fallback if that layer is
 * unavailable or fails its faithfulness check. It is also useful on its
 * own, rendered directly, with no AI involved at all.
 */
import { SENSITIVE_LDL_THRESHOLD_DB } from '../components/ldl/LdlResults';
import { LdlRun, MatchRun } from '../types';

export type TrendDirection = 'improving' | 'worsening' | 'stable';

export interface LdlTrendInsight {
  type: 'ldl_trend';
  f0: number;
  direction: TrendDirection;
  firstDb: number | null; // null means "comfortable up to the safety cap"
  lastDb: number | null;
  runCount: number;
}

export interface PersistentTriggerInsight {
  type: 'persistent_trigger';
  f0: number;
  occurrences: number;
  totalRuns: number;
}

/**
 * Pitch moving up or down has no inherent "better/worse" the way a comfort
 * threshold or a bother rating does, so this deliberately uses its own
 * direction vocabulary rather than reusing TrendDirection's
 * improving/worsening, which would imply a clinical judgment that isn't
 * there.
 */
export type DriftDirection = 'up' | 'down' | 'stable';

export interface MatchDriftInsight {
  type: 'match_drift';
  direction: DriftDirection;
  firstHz: number;
  lastHz: number;
  runCount: number;
}

export interface BotherTrendInsight {
  type: 'bother_trend';
  direction: TrendDirection;
  firstScore: number;
  lastScore: number;
  runCount: number;
}

export interface InsufficientDataInsight {
  type: 'insufficient_data';
  area: 'ldl' | 'match';
}

export type Insight =
  | LdlTrendInsight
  | PersistentTriggerInsight
  | MatchDriftInsight
  | BotherTrendInsight
  | InsufficientDataInsight;

const MIN_RUNS_FOR_TREND = 2;
/** A persistent trigger needs to show up in at least this fraction of runs. */
const PERSISTENT_TRIGGER_RATIO = 0.5;
/** Below this dB (or Hz, scaled) change, call it "stable" rather than a trend. */
const LDL_STABLE_EPSILON_DB = 3;
const MATCH_STABLE_EPSILON_HZ = 100;
const BOTHER_STABLE_EPSILON = 1;

function oldestFirst<T extends { timestamp: number }>(runs: readonly T[]): T[] {
  return [...runs].sort((a, b) => a.timestamp - b.timestamp);
}

/** Higher ldlDb (or null = no discomfort found, treated as "above the cap")
 * means MORE tolerant, i.e. improving. */
function ldlDirection(firstDb: number | null, lastDb: number | null): TrendDirection {
  const firstVal = firstDb ?? Infinity;
  const lastVal = lastDb ?? Infinity;
  if (firstVal === Infinity && lastVal === Infinity) return 'stable';
  if (lastVal === Infinity) return 'improving'; // no longer uncomfortable at any tested level
  if (firstVal === Infinity) return 'worsening'; // now uncomfortable where it wasn't before
  const delta = lastVal - firstVal;
  if (Math.abs(delta) < LDL_STABLE_EPSILON_DB) return 'stable';
  return delta > 0 ? 'improving' : 'worsening';
}

export function computeLdlInsights(runs: readonly LdlRun[]): Insight[] {
  if (runs.length === 0) return [{ type: 'insufficient_data', area: 'ldl' }];

  const ordered = oldestFirst(runs);
  const insights: Insight[] = [];

  // Group by exact frequency -- LDL_TEST_FREQUENCIES_HZ is a fixed set
  // presented in the same order every run, so exact matching is safe here.
  const byFreq = new Map<number, { db: number | null; runIndex: number }[]>();
  ordered.forEach((run, runIndex) => {
    run.results.forEach((r) => {
      const list = byFreq.get(r.f0) ?? [];
      list.push({ db: r.ldlDb, runIndex });
      byFreq.set(r.f0, list);
    });
  });

  for (const [f0, entries] of byFreq) {
    if (entries.length >= MIN_RUNS_FOR_TREND) {
      const firstDb = entries[0].db;
      const lastDb = entries[entries.length - 1].db;
      insights.push({
        type: 'ldl_trend',
        f0,
        direction: ldlDirection(firstDb, lastDb),
        firstDb,
        lastDb,
        runCount: entries.length,
      });
    }

    const uncomfortableCount = entries.filter(
      (e) => e.db !== null && e.db <= SENSITIVE_LDL_THRESHOLD_DB,
    ).length;
    if (
      ordered.length >= MIN_RUNS_FOR_TREND &&
      uncomfortableCount / ordered.length >= PERSISTENT_TRIGGER_RATIO
    ) {
      insights.push({
        type: 'persistent_trigger',
        f0,
        occurrences: uncomfortableCount,
        totalRuns: ordered.length,
      });
    }
  }

  return insights.length > 0 ? insights : [{ type: 'insufficient_data', area: 'ldl' }];
}

export function computeMatchInsights(runs: readonly MatchRun[]): Insight[] {
  if (runs.length === 0) return [{ type: 'insufficient_data', area: 'match' }];
  if (runs.length < MIN_RUNS_FOR_TREND) return [{ type: 'insufficient_data', area: 'match' }];

  const ordered = oldestFirst(runs);
  const insights: Insight[] = [];

  const firstHz = ordered[0].f0;
  const lastHz = ordered[ordered.length - 1].f0;
  const hzDelta = lastHz - firstHz;
  insights.push({
    type: 'match_drift',
    direction: Math.abs(hzDelta) < MATCH_STABLE_EPSILON_HZ ? 'stable' : hzDelta > 0 ? 'up' : 'down',
    firstHz,
    lastHz,
    runCount: ordered.length,
  });

  const scored = ordered.filter((r) => r.botherScore !== null) as (MatchRun & { botherScore: number })[];
  if (scored.length >= MIN_RUNS_FOR_TREND) {
    const firstScore = scored[0].botherScore;
    const lastScore = scored[scored.length - 1].botherScore;
    const delta = lastScore - firstScore;
    insights.push({
      type: 'bother_trend',
      direction: Math.abs(delta) < BOTHER_STABLE_EPSILON ? 'stable' : delta < 0 ? 'improving' : 'worsening',
      firstScore,
      lastScore,
      runCount: scored.length,
    });
  }

  return insights;
}

export function computeInsights(ldlRuns: readonly LdlRun[], matchRuns: readonly MatchRun[]): Insight[] {
  return [...computeLdlInsights(ldlRuns), ...computeMatchInsights(matchRuns)];
}

/** Every number that appears in an insight, rounded the same way a summary
 * would render it -- used by llmSummary.ts's faithfulness check to verify a
 * generated summary didn't introduce a number that isn't actually there. */
export function numbersIn(insight: Insight): number[] {
  switch (insight.type) {
    case 'ldl_trend':
      return [insight.f0, insight.firstDb, insight.lastDb, insight.runCount].filter(
        (n): n is number => n !== null,
      );
    case 'persistent_trigger':
      return [insight.f0, insight.occurrences, insight.totalRuns];
    case 'match_drift':
      return [insight.firstHz, insight.lastHz, insight.runCount];
    case 'bother_trend':
      return [insight.firstScore, insight.lastScore, insight.runCount];
    case 'insufficient_data':
      return [];
  }
}

/** A plain, deterministic sentence per insight -- the always-available
 * fallback when no LLM summary is used or one fails validation. */
export function describeInsight(insight: Insight): string {
  switch (insight.type) {
    case 'ldl_trend': {
      const fmt = (db: number | null) => (db === null ? 'comfortable at every level tested' : `${db} dB`);
      return `At ${insight.f0} Hz, your comfort threshold went from ${fmt(insight.firstDb)} to ${fmt(insight.lastDb)} over ${insight.runCount} tests (${insight.direction}).`;
    }
    case 'persistent_trigger':
      return `${insight.f0} Hz has come up as uncomfortable in ${insight.occurrences} of your last ${insight.totalRuns} tests.`;
    case 'match_drift':
      return `The pitch you matched moved from ${insight.firstHz} Hz to ${insight.lastHz} Hz over ${insight.runCount} sessions.`;
    case 'bother_trend':
      return `Your bother rating went from ${insight.firstScore} to ${insight.lastScore} out of 10 (${insight.direction}).`;
    case 'insufficient_data':
      return `Not enough ${insight.area === 'ldl' ? 'loudness comfort' : 'match your sound'} runs yet for a trend.`;
  }
}

/** True once there's at least one real insight to show -- i.e. not just a
 * list of "insufficient_data" placeholders. A new user with no history yet
 * gets a screen with no summary card at all, not an awkward "not enough
 * data" message taking up space before they've done anything. */
export function hasRealData(insights: readonly Insight[]): boolean {
  return insights.some((i) => i.type !== 'insufficient_data');
}
