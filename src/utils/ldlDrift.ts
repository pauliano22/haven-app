import { LDL_DRIFT_WARN_DB, LDL_TEST_FREQUENCIES_HZ, MAX_TONE_LEVEL_DB } from '../constants/safety';
import { FilterBand, LdlRun } from '../types';

/**
 * Detect the over-protection signal: a band the user is actively softening,
 * at a frequency where their loudness comfort level has fallen materially
 * since their first comfort test. Formby et al. 2003 showed chronic
 * attenuation lowers LDLs (docs/clinical-basis.md §1b); this is the app's
 * way of noticing if that is happening here. Detection only — the card that
 * shows it asks, never acts.
 */

/** Bands further than this (in octaves) from every test frequency are not assessed. */
const MAX_OCTAVE_DISTANCE = 1 / 3;

export interface LdlDriftWarning {
  bandId: string;
  /** The band's own frequency, Hz. */
  f0: number;
  /** The comfort-test frequency it was assessed against, Hz. */
  testFreqHz: number;
  /** LDL at testFreqHz in the user's first run (ceiling if it was comfortable throughout). */
  baselineLdlDb: number;
  /** LDL at testFreqHz in the user's most recent run that measured it. */
  latestLdlDb: number;
  /** baselineLdlDb - latestLdlDb, always ≥ LDL_DRIFT_WARN_DB. */
  dropDb: number;
}

/** Nearest LDL test frequency within MAX_OCTAVE_DISTANCE of f0, else null. */
export function nearestTestFrequency(f0: number): number | null {
  if (!(f0 > 0)) return null;
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const f of LDL_TEST_FREQUENCIES_HZ) {
    const octaves = Math.abs(Math.log2(f0 / f));
    if (octaves < bestDistance) {
      bestDistance = octaves;
      best = f;
    }
  }
  return bestDistance <= MAX_OCTAVE_DISTANCE ? best : null;
}

/** The measured LDL at f in a run; the ceiling if the run reached the cap there; null if not tested. */
function ldlAt(run: LdlRun, f: number): number | null {
  const r = run.results.find((x) => x.f0 === f);
  if (!r) return null;
  return r.ldlDb ?? MAX_TONE_LEVEL_DB;
}

/**
 * @param history LDL runs, newest first (the order LdlHistoryStore returns).
 * @param bands   Currently active bands; bands with no softening are skipped.
 */
export function findLdlDrift(history: LdlRun[], bands: FilterBand[]): LdlDriftWarning[] {
  if (history.length < 2) return [];
  const oldestFirst = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const warnings: LdlDriftWarning[] = [];

  for (const band of bands) {
    if (!(band.attenDb > 0)) continue;
    const testFreqHz = nearestTestFrequency(band.f0);
    if (testFreqHz === null) continue;

    // Baseline: the first run that tested this frequency at all. Latest: the
    // most recent run where it was actually uncomfortable somewhere below the
    // ceiling (a run that was comfortable to the cap is not a drop).
    const baselineRun = oldestFirst.find((run) => ldlAt(run, testFreqHz) !== null);
    const latestRun = [...oldestFirst]
      .reverse()
      .find((run) => run.results.some((r) => r.f0 === testFreqHz && r.ldlDb !== null));
    if (!baselineRun || !latestRun || baselineRun === latestRun) continue;

    const baselineLdlDb = ldlAt(baselineRun, testFreqHz);
    const latestLdlDb = ldlAt(latestRun, testFreqHz);
    if (baselineLdlDb === null || latestLdlDb === null) continue;

    const dropDb = baselineLdlDb - latestLdlDb;
    if (dropDb >= LDL_DRIFT_WARN_DB) {
      warnings.push({ bandId: band.id, f0: band.f0, testFreqHz, baselineLdlDb, latestLdlDb, dropDb });
    }
  }
  return warnings;
}
