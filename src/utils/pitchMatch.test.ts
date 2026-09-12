import {
  initialBracket,
  isConverged,
  matchedFrequency,
  narrowBracket,
  nextTrialPair,
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
