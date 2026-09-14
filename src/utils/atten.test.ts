import { ATTEN_MAX_DB, ATTEN_MIN_DB } from '../constants/dsp';
import { TOLERANCE_STEP_DB } from '../constants/tolerance';
import {
  ATTEN_PAUSED_DB,
  attenLabel,
  isPaused,
  normalizeAtten,
  nudgeAtten,
  stepDownAtten,
} from './atten';

describe('atten policy', () => {
  it('treats 0 as paused and everything from the floor up as active', () => {
    expect(isPaused(0)).toBe(true);
    expect(isPaused(ATTEN_MIN_DB)).toBe(false);
    expect(attenLabel(0)).toMatch(/Paused/);
    expect(attenLabel(ATTEN_MAX_DB)).toBe('Fully softened');
  });

  it('normalises the dead zone between 0 and the floor away', () => {
    expect(normalizeAtten(0)).toBe(ATTEN_PAUSED_DB);
    expect(normalizeAtten(-4)).toBe(ATTEN_PAUSED_DB);
    expect(normalizeAtten(1)).toBe(ATTEN_MIN_DB);
    expect(normalizeAtten(ATTEN_MIN_DB - 0.5)).toBe(ATTEN_MIN_DB);
    expect(normalizeAtten(19.6)).toBe(20);
    expect(normalizeAtten(99)).toBe(ATTEN_MAX_DB);
    expect(normalizeAtten(NaN)).toBe(ATTEN_PAUSED_DB);
  });

  it('a comfort nudge never pauses a band, and resumes a paused one gently', () => {
    expect(nudgeAtten(ATTEN_MIN_DB, -3)).toBe(ATTEN_MIN_DB);
    expect(nudgeAtten(0, -3)).toBe(0);
    expect(nudgeAtten(0, +3)).toBe(ATTEN_MIN_DB);
    expect(nudgeAtten(20, +3)).toBe(23);
    expect(nudgeAtten(ATTEN_MAX_DB, +3)).toBe(ATTEN_MAX_DB);
  });

  it('a tolerance step lands on paused when it would cross the floor', () => {
    expect(stepDownAtten(20, TOLERANCE_STEP_DB)).toBe(17);
    expect(stepDownAtten(ATTEN_MIN_DB, TOLERANCE_STEP_DB)).toBe(ATTEN_PAUSED_DB);
    expect(stepDownAtten(4, TOLERANCE_STEP_DB)).toBe(ATTEN_PAUSED_DB); // 1 dB is in the dead zone
    expect(stepDownAtten(6, TOLERANCE_STEP_DB)).toBe(ATTEN_MIN_DB);
  });
});
