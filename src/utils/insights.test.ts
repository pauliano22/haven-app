import { LdlRun, MatchRun } from '../types';
import {
  BotherTrendInsight,
  computeInsights,
  computeLdlInsights,
  computeMatchInsights,
  describeInsight,
  Insight,
  LdlTrendInsight,
  MatchDriftInsight,
  numbersIn,
  PersistentTriggerInsight,
} from './insights';

function ldlRun(timestamp: number, results: { f0: number; ldlDb: number | null }[]): LdlRun {
  return { timestamp, results };
}

function matchRun(timestamp: number, f0: number, loudnessDb: number, botherScore: number | null = null): MatchRun {
  return { timestamp, f0, loudnessDb, botherScore };
}

describe('computeLdlInsights', () => {
  it('reports insufficient_data with no runs', () => {
    expect(computeLdlInsights([])).toEqual([{ type: 'insufficient_data', area: 'ldl' }]);
  });

  it('finds an improving trend when the threshold rises over time', () => {
    const runs = [
      ldlRun(1000, [{ f0: 4000, ldlDb: 60 }]),
      ldlRun(2000, [{ f0: 4000, ldlDb: 75 }]),
    ];
    const insights = computeLdlInsights(runs);
    const trend = insights.find((i): i is LdlTrendInsight => i.type === 'ldl_trend' && i.f0 === 4000);
    expect(trend).toBeDefined();
    expect(trend!.direction).toBe('improving');
    expect(trend!.firstDb).toBe(60);
    expect(trend!.lastDb).toBe(75);
  });

  it('finds a worsening trend when the threshold drops', () => {
    const runs = [
      ldlRun(1000, [{ f0: 4000, ldlDb: 75 }]),
      ldlRun(2000, [{ f0: 4000, ldlDb: 55 }]),
    ];
    const trend = computeLdlInsights(runs).find(
      (i): i is LdlTrendInsight => i.type === 'ldl_trend',
    );
    expect(trend!.direction).toBe('worsening');
  });

  it('treats a small change as stable, not a trend either way', () => {
    const runs = [
      ldlRun(1000, [{ f0: 4000, ldlDb: 70 }]),
      ldlRun(2000, [{ f0: 4000, ldlDb: 71 }]),
    ];
    const trend = computeLdlInsights(runs).find(
      (i): i is LdlTrendInsight => i.type === 'ldl_trend',
    );
    expect(trend!.direction).toBe('stable');
  });

  it('treats null (comfortable up to the safety cap) as more tolerant than any real dB value', () => {
    const wentComfortable = computeLdlInsights([
      ldlRun(1000, [{ f0: 4000, ldlDb: 50 }]),
      ldlRun(2000, [{ f0: 4000, ldlDb: null }]),
    ]).find((i): i is LdlTrendInsight => i.type === 'ldl_trend')!;
    expect(wentComfortable.direction).toBe('improving');

    const gotUncomfortable = computeLdlInsights([
      ldlRun(1000, [{ f0: 4000, ldlDb: null }]),
      ldlRun(2000, [{ f0: 4000, ldlDb: 50 }]),
    ]).find((i): i is LdlTrendInsight => i.type === 'ldl_trend')!;
    expect(gotUncomfortable.direction).toBe('worsening');
  });

  it('flags a frequency as a persistent trigger once it is uncomfortable in at least half of runs', () => {
    const runs = [
      ldlRun(1000, [{ f0: 6000, ldlDb: 60 }]), // uncomfortable (<= 70)
      ldlRun(2000, [{ f0: 6000, ldlDb: 65 }]), // uncomfortable
      ldlRun(3000, [{ f0: 6000, ldlDb: 90 }]), // comfortable
      ldlRun(4000, [{ f0: 6000, ldlDb: 90 }]), // comfortable
    ];
    const trigger = computeLdlInsights(runs).find(
      (i): i is PersistentTriggerInsight => i.type === 'persistent_trigger',
    );
    expect(trigger).toBeDefined();
    expect(trigger!.occurrences).toBe(2);
    expect(trigger!.totalRuns).toBe(4);
  });

  it('does not flag a frequency uncomfortable in fewer than half the runs', () => {
    const runs = [
      ldlRun(1000, [{ f0: 6000, ldlDb: 60 }]),
      ldlRun(2000, [{ f0: 6000, ldlDb: 90 }]),
      ldlRun(3000, [{ f0: 6000, ldlDb: 90 }]),
    ];
    const trigger = computeLdlInsights(runs).find((i) => i.type === 'persistent_trigger');
    expect(trigger).toBeUndefined();
  });

  it('processes independent frequencies independently', () => {
    const runs = [
      ldlRun(1000, [
        { f0: 4000, ldlDb: 60 },
        { f0: 8000, ldlDb: 80 },
      ]),
      ldlRun(2000, [
        { f0: 4000, ldlDb: 60 },
        { f0: 8000, ldlDb: 40 },
      ]),
    ];
    const insights = computeLdlInsights(runs);
    const at4k = insights.find((i): i is LdlTrendInsight => i.type === 'ldl_trend' && i.f0 === 4000)!;
    const at8k = insights.find((i): i is LdlTrendInsight => i.type === 'ldl_trend' && i.f0 === 8000)!;
    expect(at4k.direction).toBe('stable');
    expect(at8k.direction).toBe('worsening');
  });

  it('does not depend on the order runs are passed in', () => {
    const oldRun = ldlRun(1000, [{ f0: 4000, ldlDb: 60 }]);
    const newRun = ldlRun(2000, [{ f0: 4000, ldlDb: 75 }]);
    const forward = computeLdlInsights([oldRun, newRun]);
    const backward = computeLdlInsights([newRun, oldRun]);
    expect(forward).toEqual(backward);
  });
});

describe('computeMatchInsights', () => {
  it('reports insufficient_data with fewer than 2 runs', () => {
    expect(computeMatchInsights([])).toEqual([{ type: 'insufficient_data', area: 'match' }]);
    expect(computeMatchInsights([matchRun(1000, 4000, 30)])).toEqual([
      { type: 'insufficient_data', area: 'match' },
    ]);
  });

  it('reports pitch drift direction without implying it is good or bad', () => {
    const up = computeMatchInsights([matchRun(1000, 3000, 30), matchRun(2000, 4000, 30)]).find(
      (i): i is MatchDriftInsight => i.type === 'match_drift',
    )!;
    expect(up.direction).toBe('up');

    const down = computeMatchInsights([matchRun(1000, 4000, 30), matchRun(2000, 3000, 30)]).find(
      (i): i is MatchDriftInsight => i.type === 'match_drift',
    )!;
    expect(down.direction).toBe('down');
  });

  it('finds an improving bother trend as the score drops, ignoring runs with no score', () => {
    const runs = [
      matchRun(1000, 4000, 30, 7),
      matchRun(1500, 4000, 30, null), // skipped -- no score recorded
      matchRun(2000, 4000, 30, 3),
    ];
    const bother = computeMatchInsights(runs).find(
      (i): i is BotherTrendInsight => i.type === 'bother_trend',
    );
    expect(bother).toBeDefined();
    expect(bother!.direction).toBe('improving');
    expect(bother!.firstScore).toBe(7);
    expect(bother!.lastScore).toBe(3);
  });

  it('omits a bother trend entirely when fewer than 2 runs have a score', () => {
    const runs = [matchRun(1000, 4000, 30, 5), matchRun(2000, 4000, 30, null)];
    const bother = computeMatchInsights(runs).find((i) => i.type === 'bother_trend');
    expect(bother).toBeUndefined();
  });
});

describe('computeInsights', () => {
  it('combines both areas', () => {
    const insights = computeInsights(
      [ldlRun(1000, [{ f0: 4000, ldlDb: 60 }]), ldlRun(2000, [{ f0: 4000, ldlDb: 75 }])],
      [matchRun(1000, 3000, 30), matchRun(2000, 4000, 30)],
    );
    expect(insights.some((i) => i.type === 'ldl_trend')).toBe(true);
    expect(insights.some((i) => i.type === 'match_drift')).toBe(true);
  });
});

describe('numbersIn / describeInsight', () => {
  const cases: Insight[] = [
    { type: 'ldl_trend', f0: 4000, direction: 'improving', firstDb: 60, lastDb: 75, runCount: 2 },
    { type: 'ldl_trend', f0: 4000, direction: 'improving', firstDb: null, lastDb: 75, runCount: 2 },
    { type: 'persistent_trigger', f0: 6000, occurrences: 3, totalRuns: 4 },
    { type: 'match_drift', direction: 'up', firstHz: 3000, lastHz: 4000, runCount: 2 },
    { type: 'bother_trend', direction: 'improving', firstScore: 7, lastScore: 3, runCount: 2 },
    { type: 'insufficient_data', area: 'ldl' },
  ];

  it('numbersIn only ever returns numbers that actually appear on the insight', () => {
    for (const insight of cases) {
      const nums = numbersIn(insight);
      for (const n of nums) expect(typeof n).toBe('number');
    }
    // Spot check a specific one so this isn't just a type-level tautology.
    expect(numbersIn(cases[0])).toEqual([4000, 60, 75, 2]);
    expect(numbersIn(cases[1])).toEqual([4000, 75, 2]); // null firstDb excluded
  });

  it('describeInsight never throws and produces non-empty text for every case', () => {
    for (const insight of cases) {
      const text = describeInsight(insight);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
