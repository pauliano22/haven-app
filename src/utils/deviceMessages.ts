import { LIMITER_SAFE_DAC_SOURCES } from '../constants/safety';
import { DeviceAck, DeviceBootInfo, DeviceEvent, DeviceMessage, DspPayload } from '../types';

/**
 * Device → app wire protocol (haven-zephyr-app docs/nus-acks.md). Pure: no
 * BLE, no React. `BleConnectionManager` feeds it raw notification text.
 */

const COMMAND_TYPES: ReadonlySet<string> = new Set<DspPayload['type']>([
  'MULTI_FILTER',
  'BYPASS',
  'TONE_START',
  'TONE_LEVEL',
  'TONE_STOP',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parseAck(obj: Record<string, unknown>): DeviceAck | null {
  const cmd = obj.ack;
  if (typeof cmd !== 'string') return null;

  if (obj.ok === false) {
    const err = obj.err === 'parse' || obj.err === 'dsp' ? obj.err : 'unknown';
    const code = finiteNumber(obj.code);
    const known = COMMAND_TYPES.has(cmd) ? (cmd as DspPayload['type']) : '?';
    return code === null
      ? { kind: 'ack', cmd: known, ok: false, err }
      : { kind: 'ack', cmd: known, ok: false, err, code };
  }
  if (obj.ok !== true) return null;

  switch (cmd) {
    case 'MULTI_FILTER': {
      const bands = finiteNumber(obj.bands);
      return bands === null ? null : { kind: 'ack', cmd, ok: true, bands };
    }
    case 'BYPASS':
      return typeof obj.enabled === 'boolean'
        ? { kind: 'ack', cmd, ok: true, enabled: obj.enabled }
        : null;
    case 'TONE_START': {
      const f0 = finiteNumber(obj.f0);
      const levelDb = finiteNumber(obj.level_db);
      return f0 === null || levelDb === null ? null : { kind: 'ack', cmd, ok: true, f0, levelDb };
    }
    case 'TONE_LEVEL': {
      const levelDb = finiteNumber(obj.level_db);
      return levelDb === null ? null : { kind: 'ack', cmd, ok: true, levelDb };
    }
    case 'TONE_STOP':
      return { kind: 'ack', cmd, ok: true };
    default:
      // A future command type this app version doesn't know: ignore, don't throw.
      return null;
  }
}

function parseEvent(obj: Record<string, unknown>): DeviceEvent | null {
  switch (obj.event) {
    case 'boot': {
      const fdspRate = finiteNumber(obj.fdsp_rate);
      if (typeof obj.fw !== 'string' || typeof obj.dac_source !== 'string' || fdspRate === null) {
        return null;
      }
      return { kind: 'event', event: 'boot', fw: obj.fw, fdspRate, dacSource: obj.dac_source };
    }
    case 'tone_watchdog':
      return { kind: 'event', event: 'tone_watchdog' };
    default:
      return null;
  }
}

/**
 * Parse one newline-stripped line. Returns null for anything that isn't a
 * message this app understands (garbage, a truncated line, a future message
 * type) — forward-compatible by design, never throws.
 */
export function parseDeviceLine(line: string): DeviceMessage | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  if ('ack' in parsed) return parseAck(parsed);
  if ('event' in parsed) return parseEvent(parsed);
  return null;
}

/**
 * Reassembles `\n`-framed lines from notification chunks. The firmware sends
 * one whole line per notification today, but the contract says not to rely
 * on it: a line may arrive split across two packets, or two lines in one.
 */
export class LineBuffer {
  private pending = '';

  /** Feed a chunk; returns every complete line it closed (without the `\n`). */
  feed(chunk: string): string[] {
    this.pending += chunk;
    const lines: string[] = [];
    let nl: number;
    while ((nl = this.pending.indexOf('\n')) >= 0) {
      lines.push(this.pending.slice(0, nl));
      this.pending = this.pending.slice(nl + 1);
    }
    return lines;
  }

  /** Drop any partial line (on connect/disconnect). */
  reset(): void {
    this.pending = '';
  }
}

/**
 * Safety gate for the LDL test and match tones (docs/safety.md): a bench
 * build that reports a DAC source without the output limiter must not play
 * test tones into anyone's ear. Before the boot event arrives (or on a
 * firmware old enough not to send one) the gate stays open — the firmware's
 * own 85 dB clamp and watchdog still apply — so this only ever *adds* a
 * refusal, never removes one.
 */
export function hearingTestsAllowed(info: DeviceBootInfo | null): boolean {
  if (info === null) return true;
  return LIMITER_SAFE_DAC_SOURCES.includes(info.dacSource);
}

/** The user-facing reason shown wherever hearingTestsAllowed() is false. */
export const HEARING_TESTS_DISABLED_TEXT =
  'This device is running bench firmware without an output limiter, so the hearing tests are disabled. Softening still works.';
