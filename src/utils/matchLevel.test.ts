import {
  MATCH_LDL_MARGIN_DB,
  MATCH_LOUDNESS_MAX_DB,
  MATCH_LOUDNESS_MIN_DB,
  MATCH_LOUDNESS_START_DB,
  MATCH_PITCH_TONE_LEVEL_DB,
} from '../constants/safety';
import { LdlRun } from '../types';
import { ldlAwareMatchLevels, lowestRecentLdlDb } from './matchLevel';

const run = (timestamp: number, ldls: Array<number | null>): LdlRun => ({
  timestamp,
  results: ldls.map((ldlDb, i) => ({ f0: [1000, 2000, 3000, 4000, 6000, 8000][i], ldlDb })),
});

describe('matchLevel', () => {
  it('imposes no cap without any comfort-test history', () => {
    const levels = ldlAwareMatchLevels([]);
    expect(levels).toEqual({
      pitchLevelDb: MATCH_PITCH_TONE_LEVEL_DB,
      loudnessMaxDb: MATCH_LOUDNESS_MAX_DB,
      loudnessStartDb: MATCH_LOUDNESS_START_DB,
      cappedByLdlDb: null,
    });
  });

  it('imposes no cap when every tone was comfortable to the ceiling', () => {
    const levels = ldlAwareMatchLevels([run(2, [null, null, null, null, null, null])]);
    expect(levels.cappedByLdlDb).toBeNull();
    expect(levels.pitchLevelDb).toBe(MATCH_PITCH_TONE_LEVEL_DB);
  });

  it('leaves the defaults alone when the lowest LDL is comfortably above them', () => {
    // 80 - 10 = 70: pitch stays 55, loudness max stays 70.
    const levels = ldlAwareMatchLevels([run(2, [80, null, 82, null, null, null])]);
    expect(levels.pitchLevelDb).toBe(MATCH_PITCH_TONE_LEVEL_DB);
    expect(levels.loudnessMaxDb).toBe(MATCH_LOUDNESS_MAX_DB);
    expect(levels.cappedByLdlDb).toBeNull();
  });

  it('caps both levels at (lowest LDL - margin) for a sensitive user', () => {
    const levels = ldlAwareMatchLevels([run(2, [null, 48, 60, null, null, null])]);
    expect(levels.pitchLevelDb).toBe(48 - MATCH_LDL_MARGIN_DB);
    expect(levels.loudnessMaxDb).toBe(48 - MATCH_LDL_MARGIN_DB);
    expect(levels.loudnessStartDb).toBe(Math.min(MATCH_LOUDNESS_START_DB, 48 - MATCH_LDL_MARGIN_DB));
    expect(levels.cappedByLdlDb).toBe(48);
  });

  it('never drops below the loudness floor, and the start never exceeds the max', () => {
    const levels = ldlAwareMatchLevels([run(2, [12, null, null, null, null, null])]);
    expect(levels.pitchLevelDb).toBe(MATCH_LOUDNESS_MIN_DB);
    expect(levels.loudnessMaxDb).toBe(MATCH_LOUDNESS_MIN_DB);
    expect(levels.loudnessStartDb).toBeLessThanOrEqual(levels.loudnessMaxDb);
  });

  it('only ever lowers levels -- a high LDL cannot raise them past the constants', () => {
    const levels = ldlAwareMatchLevels([run(2, [150, 150, 150, 150, 150, 150])]);
    expect(levels.pitchLevelDb).toBe(MATCH_PITCH_TONE_LEVEL_DB);
    expect(levels.loudnessMaxDb).toBe(MATCH_LOUDNESS_MAX_DB);
  });

  it('uses the most recent run that measured anything, not the all-time minimum', () => {
    // Newest first, as LdlHistoryStore returns it.
    const history = [
      run(3, [null, null, null, null, null, null]), // newest: all comfortable -> skipped
      run(2, [65, null, null, null, null, null]),
      run(1, [40, null, null, null, null, null]), // oldest, worst -- must not be used
    ];
    expect(lowestRecentLdlDb(history)).toBe(65);
    expect(ldlAwareMatchLevels(history).pitchLevelDb).toBe(MATCH_PITCH_TONE_LEVEL_DB);
  });
});
