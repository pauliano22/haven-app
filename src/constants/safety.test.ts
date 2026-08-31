import { clampToneLevel, MAX_TONE_LEVEL_DB } from './safety';

describe('clampToneLevel', () => {
  it('passes through values already in range', () => {
    expect(clampToneLevel(42)).toBe(42);
  });

  it('never exceeds the absolute ceiling', () => {
    expect(clampToneLevel(MAX_TONE_LEVEL_DB + 50)).toBe(MAX_TONE_LEVEL_DB);
  });

  it('never goes negative', () => {
    expect(clampToneLevel(-10)).toBe(0);
  });

  it('falls back to the safe starting level for non-finite input', () => {
    expect(clampToneLevel(NaN)).toBe(30);
    expect(clampToneLevel(Infinity)).toBe(30);
    expect(clampToneLevel(-Infinity)).toBe(30);
  });
});
