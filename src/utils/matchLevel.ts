import {
  MATCH_LDL_MARGIN_DB,
  MATCH_LOUDNESS_MAX_DB,
  MATCH_LOUDNESS_MIN_DB,
  MATCH_LOUDNESS_START_DB,
  MATCH_PITCH_TONE_LEVEL_DB,
} from '../constants/safety';
import { LdlRun } from '../types';

/**
 * Presentation levels for "Match your sound", lowered when the user's own
 * comfort test says 55 dB may already be uncomfortable for them.
 *
 * Uses the most recent *completed* comfort-test run, not the all-time
 * minimum: LDLs move (that is the point of the tolerance plan), and the
 * current measurement is the best picture of the current ear. Runs where
 * every tone was comfortable up to the ceiling (all `ldlDb === null`) impose
 * no cap. Every value returned here still goes through clampToneLevel() at
 * the payload boundary — this helper only ever lowers, never raises.
 */
export interface MatchLevels {
  /** Level for the pitch-comparison and octave-check bursts. */
  pitchLevelDb: number;
  /** Upper bound of the loudness-match slider. */
  loudnessMaxDb: number;
  /** Where the loudness-match slider starts. */
  loudnessStartDb: number;
  /** Lowest LDL the cap was derived from, or null when nothing capped. */
  cappedByLdlDb: number | null;
}

/** Lowest measured LDL in the newest run that has at least one measurement. */
export function lowestRecentLdlDb(history: LdlRun[]): number | null {
  for (const run of history) {
    const measured = run.results
      .map((r) => r.ldlDb)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (measured.length > 0) return Math.min(...measured);
  }
  return null;
}

export function ldlAwareMatchLevels(history: LdlRun[]): MatchLevels {
  const lowest = lowestRecentLdlDb(history);
  const uncapped: MatchLevels = {
    pitchLevelDb: MATCH_PITCH_TONE_LEVEL_DB,
    loudnessMaxDb: MATCH_LOUDNESS_MAX_DB,
    loudnessStartDb: MATCH_LOUDNESS_START_DB,
    cappedByLdlDb: null,
  };
  if (lowest === null) return uncapped;

  const cap = lowest - MATCH_LDL_MARGIN_DB;
  const pitchLevelDb = clamp(Math.min(MATCH_PITCH_TONE_LEVEL_DB, cap), MATCH_LOUDNESS_MIN_DB, MATCH_PITCH_TONE_LEVEL_DB);
  const loudnessMaxDb = clamp(Math.min(MATCH_LOUDNESS_MAX_DB, cap), MATCH_LOUDNESS_MIN_DB, MATCH_LOUDNESS_MAX_DB);
  const capped = pitchLevelDb < MATCH_PITCH_TONE_LEVEL_DB || loudnessMaxDb < MATCH_LOUDNESS_MAX_DB;

  return {
    pitchLevelDb,
    loudnessMaxDb,
    loudnessStartDb: Math.min(MATCH_LOUDNESS_START_DB, loudnessMaxDb),
    cappedByLdlDb: capped ? lowest : null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
