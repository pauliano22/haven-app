import { StoredFilterProfile } from '../services/FilterStore';
import {
  ConsentRecord,
  ExposureEvent,
  LdlRun,
  MatchRun,
  Nof1Trial,
  ThiRun,
  TolerancePlan,
  VasCheckIn,
} from '../types';
import { summariseTrial } from './nof1';

/**
 * Everything the app knows about one user, assembled for "Share my data".
 * Pure: the caller gathers the stores, this shapes the output. Two formats —
 * JSON (complete, for a clinician or for re-import) and CSV (the exposure
 * log and ratings as flat rows, for a spreadsheet). No identifiers beyond
 * what the user typed into the app are included, because none exist.
 */
export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportBundle {
  filterProfile: StoredFilterProfile | null;
  tolerancePlan: TolerancePlan | null;
  ldlRuns: LdlRun[];
  matchRuns: MatchRun[];
  vasCheckIns: VasCheckIn[];
  thiRuns: ThiRun[];
  trial: Nof1Trial | null;
  exposure: ExposureEvent[];
  consent: ConsentRecord | null;
}

export function buildExportJson(bundle: ExportBundle, exportedAt: number = Date.now()): string {
  const trialSummary = bundle.trial ? summariseTrial(bundle.trial) : null;
  return JSON.stringify(
    {
      schema: 'haven-export',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date(exportedAt).toISOString(),
      note:
        'All levels (dB) are the app’s commanded values, not measured sound pressure; ' +
        'see docs/safety.md and docs/calibration.md.',
      ...bundle,
      trialSummary,
    },
    null,
    2,
  );
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

/**
 * One flat table: every dated thing the app recorded, one row each, so the
 * whole history lines up on a single time axis in a spreadsheet.
 */
export function buildExportCsv(bundle: ExportBundle): string {
  const rows: string[][] = [['timestamp', 'kind', 'field', 'value', 'detail']];

  for (const e of bundle.exposure) {
    rows.push([iso(e.timestamp), 'exposure', e.type, '', e.data ? JSON.stringify(e.data) : '']);
  }
  for (const v of bundle.vasCheckIns) {
    rows.push([iso(v.timestamp), 'vas', 'loudness', String(v.loudness), '']);
    rows.push([iso(v.timestamp), 'vas', 'bother', String(v.bother), '']);
  }
  for (const t of bundle.thiRuns) {
    rows.push([iso(t.timestamp), 'thi', 'total', String(t.total), t.answers.join('|')]);
  }
  for (const r of bundle.ldlRuns) {
    for (const res of r.results) {
      rows.push([iso(r.timestamp), 'ldl', `${res.f0}Hz`, res.ldlDb === null ? '' : String(res.ldlDb), res.ldlDb === null ? 'comfortable to ceiling' : '']);
    }
  }
  for (const m of bundle.matchRuns) {
    rows.push([iso(m.timestamp), 'match', 'f0', String(m.f0), m.octaveCorrected ? 'octave-corrected' : '']);
    rows.push([iso(m.timestamp), 'match', 'loudness', m.loudnessDb === null ? '' : String(m.loudnessDb), m.loudnessDb === null ? 'not measured' : '']);
    if (m.botherScore !== null) rows.push([iso(m.timestamp), 'match', 'bother', String(m.botherScore), '']);
  }
  if (bundle.trial) {
    for (const [day, rating] of Object.entries(bundle.trial.ratings)) {
      rows.push([`${day}T12:00:00.000Z`, 'trial', 'rating', String(rating), '']);
    }
    for (const o of bundle.trial.overrides) {
      rows.push([iso(o.timestamp), 'trial', 'override', o.chosen, `assigned ${o.assigned}`]);
    }
  }

  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  // header stays first after the sort because 't' > every ISO date digit
  const header = rows.find((r) => r[0] === 'timestamp')!;
  const body = rows.filter((r) => r !== header);
  return [header, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
}
