import { buildExportCsv, buildExportJson, EXPORT_SCHEMA_VERSION, ExportBundle } from './exportData';
import { makeRng, startTrial } from './nof1';

const T0 = new Date(2026, 8, 14, 9, 0, 0).getTime();

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
  return {
    filterProfile: { bands: [{ id: '1', f0: 4500, q: 10, attenDb: 20 }], bypass: false },
    tolerancePlan: null,
    ldlRuns: [{ timestamp: T0, results: [{ f0: 1000, ldlDb: 60 }, { f0: 2000, ldlDb: null }] }],
    matchRuns: [{ timestamp: T0 + 1000, f0: 4200, loudnessDb: null, botherScore: 6, octaveCorrected: true }],
    vasCheckIns: [{ timestamp: T0 + 2000, loudness: 5, bother: 4 }],
    thiRuns: [{ timestamp: T0 + 3000, answers: Array(25).fill('no'), total: 0 }],
    trial: null,
    exposure: [{ timestamp: T0 + 4000, type: 'bands', data: { bands: [{ f0: 4500, atten: 20 }] } }],
    consent: { acceptedAt: T0, version: 1 },
    ...overrides,
  };
}

describe('buildExportJson', () => {
  it('is valid JSON with a schema tag, the calibration caveat, and a trial summary when present', () => {
    const trial = startTrial(T0, makeRng(9));
    const parsed = JSON.parse(buildExportJson(bundle({ trial }), T0));
    expect(parsed.schema).toBe('haven-export');
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.note).toMatch(/not measured sound pressure/);
    expect(parsed.trialSummary.sufficient).toBe(false);
    expect(parsed.matchRuns[0].loudnessDb).toBeNull();
    expect(parsed.exportedAt).toBe(new Date(T0).toISOString());
  });
});

describe('buildExportCsv', () => {
  it('flattens every dated record into one time-sorted table with a header', () => {
    const csv = buildExportCsv(bundle());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('timestamp,kind,field,value,detail');
    // 1 exposure + 2 vas + 1 thi + 2 ldl + 2 match(f0, loudness) + 1 match bother = 9 rows
    expect(lines).toHaveLength(10);
    const stamps = lines.slice(1).map((l) => l.split(',')[0]);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('marks a skipped loudness match as not measured rather than inventing a number', () => {
    const csv = buildExportCsv(bundle());
    const loud = csv.split('\n').find((l) => l.includes(',match,loudness,'));
    expect(loud).toBe(`${new Date(T0 + 1000).toISOString()},match,loudness,,not measured`);
  });

  it('quotes cells containing commas or quotes', () => {
    const csv = buildExportCsv(bundle({ exposure: [{ timestamp: T0, type: 'bypass', data: { note: 'a,b "c"' } }] }));
    expect(csv).toContain('"{""note"":""a,b \\""c\\""""}"');
  });
});
