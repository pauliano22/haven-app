import {
  applyOctaveChoice,
  initialBracket,
  isConverged,
  matchedFrequency,
  narrowBracket,
  nextTrialPair,
  octaveCandidates,
} from './pitchMatch';
import {
  MATCH_PITCH_MAX_HZ,
  MATCH_PITCH_MAX_TRIALS,
  MATCH_PITCH_MIN_HZ,
  MATCH_PITCH_MIN_TRIALS,
} from '../constants/safety';

describe('pitchMatch', () => {
  it('starts at the full DSP frequency range', () => {
    expect(initialBracket()).toEqual({ lowHz: MATCH_PITCH_MIN_HZ, highHz: MATCH_PITCH_MAX_HZ });
  });

  it('offers two candidates strictly inside the current bracket', () => {
    const bracket = initialBracket();
    const { fA, fB } = nextTrialPair(bracket);
    expect(fA).toBeGreaterThan(bracket.lowHz);
    expect(fA).toBeLessThan(fB);
    expect(fB).toBeLessThan(bracket.highHz);
  });

  it('narrows toward the chosen half without ever growing', () => {
    const bracket = initialBracket();
    const chosenA = narrowBracket(bracket, 'A');
    const chosenB = narrowBracket(bracket, 'B');

    expect(chosenA.lowHz).toBe(bracket.lowHz);
    expect(chosenA.highHz).toBeLessThan(bracket.highHz);

    expect(chosenB.lowHz).toBeGreaterThan(bracket.lowHz);
    expect(chosenB.highHz).toBe(bracket.highHz);

    // Both halves meet at the same log-midpoint.
    expect(chosenA.highHz).toBeCloseTo(chosenB.lowHz, 6);
  });

  it('halves the log-width on every trial, regardless of which side is chosen', () => {
    const bracket = initialBracket();
    const logWidth = (b: typeof bracket) => Math.log(b.highHz / b.lowHz);

    const afterA = narrowBracket(bracket, 'A');
    const afterB = narrowBracket(bracket, 'B');

    expect(logWidth(afterA)).toBeCloseTo(logWidth(bracket) / 2, 6);
    expect(logWidth(afterB)).toBeCloseTo(logWidth(bracket) / 2, 6);
  });

  it('never converges before MATCH_PITCH_MIN_TRIALS', () => {
    let bracket = initialBracket();
    for (let trial = 1; trial < MATCH_PITCH_MIN_TRIALS; trial++) {
      bracket = narrowBracket(bracket, 'A');
      expect(isConverged(bracket, trial)).toBe(false);
    }
  });

  it('always converges by MATCH_PITCH_MAX_TRIALS regardless of choices', () => {
    let bracket = initialBracket();
    for (let trial = 1; trial <= MATCH_PITCH_MAX_TRIALS; trial++) {
      // Alternate choices -- a pathological case that stays maximally wide.
      bracket = narrowBracket(bracket, trial % 2 === 0 ? 'A' : 'B');
    }
    expect(isConverged(bracket, MATCH_PITCH_MAX_TRIALS)).toBe(true);
  });

  it('converges within the configured trial bounds for a consistent-direction search', () => {
    let bracket = initialBracket();
    let trial = 0;
    while (!isConverged(bracket, trial) && trial < 100) {
      bracket = narrowBracket(bracket, 'A');
      trial++;
    }
    expect(trial).toBeLessThanOrEqual(MATCH_PITCH_MAX_TRIALS);
    expect(trial).toBeGreaterThanOrEqual(MATCH_PITCH_MIN_TRIALS);
  });

  it('reports the matched frequency as the bracket midpoint, within DSP bounds', () => {
    const bracket = { lowHz: 200, highHz: 224.36 };
    const f0 = matchedFrequency(bracket);
    expect(f0).toBeGreaterThanOrEqual(MATCH_PITCH_MIN_HZ);
    expect(f0).toBeLessThanOrEqual(MATCH_PITCH_MAX_HZ);
    expect(f0).toBe(Math.round(Math.sqrt(bracket.lowHz * bracket.highHz)));
  });
});

describe('octave check', () => {
  it('offers both octave neighbours for a mid-range match', () => {
    expect(octaveCandidates(2000)).toEqual({ lowerHz: 1000, upperHz: 4000 });
  });

  it('drops a neighbour that falls outside the searchable range', () => {
    expect(octaveCandidates(300)).toEqual({ lowerHz: null, upperHz: 600 });
    expect(octaveCandidates(6000)).toEqual({ lowerHz: 3000, upperHz: null });
    // Exactly at the bounds is still in range.
    expect(octaveCandidates(400).lowerHz).toBe(MATCH_PITCH_MIN_HZ);
    expect(octaveCandidates(4000).upperHz).toBe(MATCH_PITCH_MAX_HZ);
  });

  it("'match' leaves the bracket untouched", () => {
    const bracket = { lowHz: 1900, highHz: 2100 };
    expect(applyOctaveChoice(bracket, 'match')).toBe(bracket);
  });

  it('re-centres on the chosen octave while preserving the bracket ratio', () => {
    const bracket = { lowHz: 1900, highHz: 2100 };
    const ratio = bracket.highHz / bracket.lowHz;
    // Unrounded centre -- matchedFrequency() rounds, and rounding before
    // doubling can differ by 1 Hz from rounding after.
    const centre = Math.sqrt(bracket.lowHz * bracket.highHz);

    const lower = applyOctaveChoice(bracket, 'lower');
    expect(matchedFrequency(lower)).toBe(Math.round(centre / 2));
    expect(lower.highHz / lower.lowHz).toBeCloseTo(ratio, 6);

    const upper = applyOctaveChoice(bracket, 'upper');
    expect(matchedFrequency(upper)).toBe(Math.round(centre * 2));
    expect(upper.highHz / upper.lowHz).toBeCloseTo(ratio, 6);
  });

  it('clamps a re-centred bracket to the searchable range', () => {
    const nearTop = { lowHz: 3900, highHz: 4100 }; // 2f = ~8000, upper edge would exceed the max
    const upper = applyOctaveChoice(nearTop, 'upper');
    expect(upper.highHz).toBeLessThanOrEqual(MATCH_PITCH_MAX_HZ);
    expect(upper.lowHz).toBeLessThan(upper.highHz);

    const nearBottom = { lowHz: 390, highHz: 410 };
    const lower = applyOctaveChoice(nearBottom, 'lower');
    expect(lower.lowHz).toBeGreaterThanOrEqual(MATCH_PITCH_MIN_HZ);
  });

  it('refuses to move to an octave that octaveCandidates would not have offered', () => {
    const low = { lowHz: 290, highHz: 310 }; // f/2 = 150 < MIN
    expect(applyOctaveChoice(low, 'lower')).toBe(low);
    const high = { lowHz: 5900, highHz: 6100 }; // 2f = 12000 > MAX
    expect(applyOctaveChoice(high, 'upper')).toBe(high);
  });
});
