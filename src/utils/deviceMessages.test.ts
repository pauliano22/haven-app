import {
  hearingTestsAllowed,
  LineBuffer,
  parseDeviceLine,
} from './deviceMessages';

// Golden strings copied from haven-zephyr-app src/ack.h — the firmware's
// tests/host/test_ack.c asserts the same bytes.
describe('parseDeviceLine — acks', () => {
  it('MULTI_FILTER ok echoes the applied band count', () => {
    expect(parseDeviceLine('{"ack":"MULTI_FILTER","ok":true,"bands":3}')).toEqual({
      kind: 'ack',
      cmd: 'MULTI_FILTER',
      ok: true,
      bands: 3,
    });
  });

  it('BYPASS ok echoes the applied flag', () => {
    expect(parseDeviceLine('{"ack":"BYPASS","ok":true,"enabled":true}')).toEqual({
      kind: 'ack',
      cmd: 'BYPASS',
      ok: true,
      enabled: true,
    });
  });

  it('TONE_START ok echoes the applied (clamped, integer) f0 and level', () => {
    expect(parseDeviceLine('{"ack":"TONE_START","ok":true,"f0":4000,"level_db":30}')).toEqual({
      kind: 'ack',
      cmd: 'TONE_START',
      ok: true,
      f0: 4000,
      levelDb: 30,
    });
  });

  it('TONE_LEVEL ok echoes the applied level', () => {
    expect(parseDeviceLine('{"ack":"TONE_LEVEL","ok":true,"level_db":42}')).toEqual({
      kind: 'ack',
      cmd: 'TONE_LEVEL',
      ok: true,
      levelDb: 42,
    });
  });

  it('TONE_STOP ok', () => {
    expect(parseDeviceLine('{"ack":"TONE_STOP","ok":true}')).toEqual({
      kind: 'ack',
      cmd: 'TONE_STOP',
      ok: true,
    });
  });

  it('rejected line → cmd "?" and err parse', () => {
    expect(parseDeviceLine('{"ack":"?","ok":false,"err":"parse"}')).toEqual({
      kind: 'ack',
      cmd: '?',
      ok: false,
      err: 'parse',
    });
  });

  it('driver refusal → err dsp with the errno', () => {
    expect(parseDeviceLine('{"ack":"MULTI_FILTER","ok":false,"err":"dsp","code":-5}')).toEqual({
      kind: 'ack',
      cmd: 'MULTI_FILTER',
      ok: false,
      err: 'dsp',
      code: -5,
    });
  });

  it('unknown err string on a known command is kept as unknown, not dropped', () => {
    expect(parseDeviceLine('{"ack":"BYPASS","ok":false,"err":"later"}')).toEqual({
      kind: 'ack',
      cmd: 'BYPASS',
      ok: false,
      err: 'unknown',
    });
  });

  it('tolerates a trailing newline and surrounding whitespace', () => {
    expect(parseDeviceLine('  {"ack":"TONE_STOP","ok":true}\n')).toEqual({
      kind: 'ack',
      cmd: 'TONE_STOP',
      ok: true,
    });
  });
});

describe('parseDeviceLine — events', () => {
  it('boot carries fw, FastDSP rate and DAC source', () => {
    expect(
      parseDeviceLine('{"event":"boot","fw":"0.1.0-dev","fdsp_rate":192000,"dac_source":"fdsp"}'),
    ).toEqual({
      kind: 'event',
      event: 'boot',
      fw: '0.1.0-dev',
      fdspRate: 192000,
      dacSource: 'fdsp',
    });
  });

  it('boot from a smoke-test build names dmic_direct', () => {
    const msg = parseDeviceLine(
      '{"event":"boot","fw":"0.1.0-dev","fdsp_rate":192000,"dac_source":"dmic_direct"}',
    );
    expect(msg).toMatchObject({ kind: 'event', event: 'boot', dacSource: 'dmic_direct' });
  });

  it('tone_watchdog', () => {
    expect(parseDeviceLine('{"event":"tone_watchdog"}')).toEqual({
      kind: 'event',
      event: 'tone_watchdog',
    });
  });
});

describe('parseDeviceLine — forward compatibility (never throws, returns null)', () => {
  it.each([
    ['garbage', 'not json at all'],
    ['empty', ''],
    ['truncated JSON', '{"ack":"MULTI_FILTER","ok":tr'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON number', '42'],
    ['neither ack nor event', '{"type":"ACK","cmd":"MULTI_FILTER"}'],
    ['unknown ack command', '{"ack":"FUTURE_CMD","ok":true}'],
    ['unknown event', '{"event":"battery","pct":80}'],
    ['ok ack missing its payload field', '{"ack":"MULTI_FILTER","ok":true}'],
    ['ok that is not a boolean', '{"ack":"TONE_STOP","ok":"yes"}'],
    ['boot missing fw', '{"event":"boot","fdsp_rate":192000,"dac_source":"fdsp"}'],
    ['level that is not a number', '{"ack":"TONE_LEVEL","ok":true,"level_db":"42"}'],
  ])('%s → null', (_label, line) => {
    expect(parseDeviceLine(line)).toBeNull();
  });

  it('the old (#15) {"type":"ACK"} shape is specifically not recognised', () => {
    expect(parseDeviceLine('{"type":"ERROR"}')).toBeNull();
  });
});

describe('LineBuffer', () => {
  it('returns nothing until a newline closes the line', () => {
    const buf = new LineBuffer();
    expect(buf.feed('{"ack":"TONE_STOP"')).toEqual([]);
    expect(buf.feed(',"ok":true}\n')).toEqual(['{"ack":"TONE_STOP","ok":true}']);
  });

  it('splits two lines arriving in one packet', () => {
    const buf = new LineBuffer();
    expect(buf.feed('{"event":"tone_watchdog"}\n{"ack":"TONE_STOP","ok":true}\n')).toEqual([
      '{"event":"tone_watchdog"}',
      '{"ack":"TONE_STOP","ok":true}',
    ]);
  });

  it('keeps a trailing partial line for the next packet', () => {
    const buf = new LineBuffer();
    expect(buf.feed('{"ack":"TONE_STOP","ok":true}\n{"ack":"BYP')).toEqual([
      '{"ack":"TONE_STOP","ok":true}',
    ]);
    expect(buf.feed('ASS","ok":true,"enabled":false}\n')).toEqual([
      '{"ack":"BYPASS","ok":true,"enabled":false}',
    ]);
  });

  it('reset drops a partial line so a reconnect never glues two halves together', () => {
    const buf = new LineBuffer();
    buf.feed('{"ack":"TONE_ST');
    buf.reset();
    expect(buf.feed('{"ack":"TONE_STOP","ok":true}\n')).toEqual(['{"ack":"TONE_STOP","ok":true}']);
  });
});

describe('hearingTestsAllowed — the boot-event safety gate', () => {
  const boot = (dacSource: string) => ({ fw: '0.1.0-dev', fdspRate: 192000, dacSource });

  it('stays open before any boot event (firmware clamp + watchdog still apply)', () => {
    expect(hearingTestsAllowed(null)).toBe(true);
  });

  it('allows the product path', () => {
    expect(hearingTestsAllowed(boot('fdsp'))).toBe(true);
  });

  it('refuses the no-limiter smoke-test build', () => {
    expect(hearingTestsAllowed(boot('dmic_direct'))).toBe(false);
  });

  it('refuses any source it does not recognise (allow-list, not deny-list)', () => {
    expect(hearingTestsAllowed(boot('something_new'))).toBe(false);
    expect(hearingTestsAllowed(boot(''))).toBe(false);
  });
});
