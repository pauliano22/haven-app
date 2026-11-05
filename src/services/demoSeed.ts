import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONSENT_VERSION } from '../constants/outcomes';
import {
  ExposureEvent,
  LdlRun,
  MatchRun,
  Nof1Trial,
  ThiAnswer,
  ThiRun,
  TolerancePlan,
  VasCheckIn,
} from '../types';
import { dayKey, dayKeyFromIndex, makeRng, startTrial } from '../utils/nof1';
import { scoreThi } from '../utils/thi';
import { ComfortResponse } from './ComfortHistoryStore';
import { StoredFilterProfile } from './FilterStore';
import { DEMO_FIRMWARE_VERSION } from './DemoDevice';

/**
 * Demo mode only: example history so the Hearing, insights and evidence
 * screens have something to show. Every value here is made up for the demo
 * and the UI labels it "example data" (DemoBanner). Written once per browser
 * under the same keys the real stores use; "Reset demo" clears and rewrites.
 */

const SEEDED_KEY = 'haven.demo.seeded.v1';
const DAY = 24 * 60 * 60 * 1000;

/** Every storage key the app's stores use, so a reset leaves nothing behind. */
const HAVEN_KEYS = [
  'haven.filterProfile.v1',
  'haven.ldlHistory.v1',
  'haven.matchHistory.v1',
  'haven.outcomes.vas.v1',
  'haven.outcomes.thi.v1',
  'haven.nof1Trial.v1',
  'haven.comfortHistory.v1',
  'haven.comfortPrompt.v1',
  'haven.consent.v1',
  'haven.exposureLog.v1',
  'haven.tolerancePlan.v1',
];

function thiAnswers(yes: number, sometimes: number): ThiAnswer[] {
  const out: ThiAnswer[] = [];
  for (let i = 0; i < 25; i++) out.push(i < yes ? 'yes' : i < yes + sometimes ? 'sometimes' : 'no');
  return out;
}

export function buildDemoData(now: number) {
  const filterProfile: StoredFilterProfile = {
    bypass: false,
    bands: [
      { id: 'demo-1', f0: 4000, q: 8, attenDb: 18 },
      { id: 'demo-2', f0: 6000, q: 10, attenDb: 12 },
      { id: 'demo-3', f0: 2500, q: 4, attenDb: 6 },
    ],
  };

  const ldl: LdlRun[] = [
    {
      timestamp: now - 2 * DAY,
      fw: DEMO_FIRMWARE_VERSION,
      results: [
        { f0: 1000, ldlDb: 84 },
        { f0: 2000, ldlDb: 80 },
        { f0: 3000, ldlDb: 74 },
        { f0: 4000, ldlDb: 66 },
        { f0: 6000, ldlDb: 70 },
        { f0: 8000, ldlDb: null },
      ],
    },
    {
      timestamp: now - 23 * DAY,
      fw: DEMO_FIRMWARE_VERSION,
      results: [
        { f0: 1000, ldlDb: 82 },
        { f0: 2000, ldlDb: 78 },
        { f0: 3000, ldlDb: 70 },
        { f0: 4000, ldlDb: 62 },
        { f0: 6000, ldlDb: 66 },
        { f0: 8000, ldlDb: 80 },
      ],
    },
  ];

  const match: MatchRun[] = [
    { timestamp: now - 3 * DAY, f0: 4200, loudnessDb: 34, botherScore: 5, octaveCorrected: false, fw: DEMO_FIRMWARE_VERSION },
    { timestamp: now - 24 * DAY, f0: 4000, loudnessDb: 38, botherScore: 7, octaveCorrected: true, fw: DEMO_FIRMWARE_VERSION },
  ];

  const vas: VasCheckIn[] = [0, 7, 14, 21].map((d, i) => ({
    timestamp: now - d * DAY - 3 * 60 * 60 * 1000,
    loudness: 4 + i,
    bother: 3 + i,
  }));

  const thiOld = thiAnswers(9, 8);
  const thiNew = thiAnswers(5, 7);
  const thi: ThiRun[] = [
    { timestamp: now - 1 * DAY, answers: thiNew, total: scoreThi(thiNew) },
    { timestamp: now - 29 * DAY, answers: thiOld, total: scoreThi(thiOld) },
  ];

  // Day 12 of 28, with a schedule whose "today" is a protection-on day so the
  // demo opens protected rather than paused.
  const trialStart = now - 11 * DAY;
  let seed = 20261029;
  let base = startTrial(trialStart, makeRng(seed));
  while (base.schedule[11] !== 'active') base = startTrial(trialStart, makeRng(++seed));
  const ratings: Record<string, number> = {};
  for (let i = 0; i < 11; i++) {
    const arm = base.schedule[i];
    ratings[dayKeyFromIndex(base.startDay, i)] = arm === 'active' ? 3 + (i % 2) : 5 + (i % 3);
  }
  const trial: Nof1Trial = { ...base, ratings };

  const comfort: ComfortResponse[] = [
    { timestamp: now - 1 * DAY, direction: 'same' },
    { timestamp: now - 4 * DAY, direction: 'weaker' },
    { timestamp: now - 8 * DAY, direction: 'same' },
  ];

  const tolerance: TolerancePlan = {
    bandId: 'demo-2',
    f0: 6000,
    startedAt: now - 9 * DAY,
    lastStepAt: now - 2 * DAY,
    stepsCompleted: 2,
  };

  const exposure: ExposureEvent[] = [];
  for (let d = 13; d >= 0; d--) {
    const t = now - d * DAY;
    exposure.push({ timestamp: t + 9 * 3600e3, type: 'connected', data: { bypass: false, bands: 3 } });
    exposure.push({
      timestamp: t + 9 * 3600e3 + 60e3,
      type: 'bands',
      data: { bands: filterProfile.bands.map((b) => ({ f0: b.f0, q: b.q, atten: b.attenDb })) },
    });
    exposure.push({ timestamp: t + 17 * 3600e3, type: 'disconnected' });
  }

  return {
    filterProfile,
    ldl,
    match,
    vas,
    thi,
    trial,
    comfort,
    tolerance,
    exposure,
    consent: { acceptedAt: now - 30 * DAY, version: CONSENT_VERSION },
    todayKey: dayKey(now),
  };
}

async function writeAll(now: number): Promise<void> {
  const d = buildDemoData(now);
  await AsyncStorage.multiSet([
    ['haven.filterProfile.v1', JSON.stringify(d.filterProfile)],
    ['haven.ldlHistory.v1', JSON.stringify(d.ldl)],
    ['haven.matchHistory.v1', JSON.stringify(d.match)],
    ['haven.outcomes.vas.v1', JSON.stringify(d.vas)],
    ['haven.outcomes.thi.v1', JSON.stringify(d.thi)],
    ['haven.nof1Trial.v1', JSON.stringify(d.trial)],
    ['haven.comfortHistory.v1', JSON.stringify(d.comfort)],
    ['haven.tolerancePlan.v1', JSON.stringify(d.tolerance)],
    ['haven.consent.v1', JSON.stringify(d.consent)],
    ['haven.exposureLog.v1', JSON.stringify(d.exposure)],
    [SEEDED_KEY, String(now)],
  ]);
}

/** Write the example data the first time demo mode runs in this browser. */
export async function seedDemoDataOnce(now: number = Date.now()): Promise<void> {
  try {
    if (await AsyncStorage.getItem(SEEDED_KEY)) return;
    await writeAll(now);
  } catch {
    // Storage blocked (private window etc.): the demo still runs, just empty.
  }
}

/** Clear everything the app stored and write fresh example data. */
export async function resetDemoData(now: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...HAVEN_KEYS, SEEDED_KEY]);
    await writeAll(now);
  } catch {
    // Same as above.
  }
}
