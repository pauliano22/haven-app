export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface FilterBand {
  id: string;
  f0: number;
  q: number;
  /** dB of reduction at f0. ATTEN_MAX_DB renders/behaves as a full notch. */
  attenDb: number;
}

/** Wire format the firmware parses — uppercase Q, no UI-only fields. */
export interface WireFilterBand {
  f0: number;
  Q: number;
  atten_db: number;
}

export interface FilterPayload {
  type: 'MULTI_FILTER';
  bands: WireFilterBand[];
}

export interface BypassPayload {
  type: 'BYPASS';
  enabled: boolean;
}

// ── LDL test tone control ────────────────────────────────────────────────────
// level_db values MUST pass through clampToneLevel() (src/constants/safety.ts)
// before being placed in a payload — never construct these by hand.

export interface ToneStartPayload {
  type: 'TONE_START';
  f0: number;
  level_db: number;
}

export interface ToneLevelPayload {
  type: 'TONE_LEVEL';
  level_db: number;
}

export interface ToneStopPayload {
  type: 'TONE_STOP';
}

export type DspPayload =
  | FilterPayload
  | BypassPayload
  | ToneStartPayload
  | ToneLevelPayload
  | ToneStopPayload;

// ── Device → app messages over NUS TX ────────────────────────────────────────
// Wire contract: haven-zephyr-app docs/nus-acks.md (formatter src/ack.c).
// Every line the app writes gets exactly one ack; events are unsolicited.
// Acks echo the values the device APPLIED (after its own clamps), never the
// requested ones, and are best-effort — the app treats them as confirmation,
// not as the source of truth for its own state.

/** Which output path the connected firmware was built with (boot event). */
export type DacSource = 'fdsp' | 'dmic_direct' | (string & {});

export type DeviceAck =
  | { kind: 'ack'; cmd: 'MULTI_FILTER'; ok: true; bands: number }
  | { kind: 'ack'; cmd: 'BYPASS'; ok: true; enabled: boolean }
  | { kind: 'ack'; cmd: 'TONE_START'; ok: true; f0: number; levelDb: number }
  | { kind: 'ack'; cmd: 'TONE_LEVEL'; ok: true; levelDb: number }
  | { kind: 'ack'; cmd: 'TONE_STOP'; ok: true }
  | {
      kind: 'ack';
      /** The command type, or '?' when the line never parsed. */
      cmd: DspPayload['type'] | '?';
      ok: false;
      /** parse = malformed line; dsp = the codec driver refused (code = errno); unknown = future type. */
      err: 'parse' | 'dsp' | 'unknown';
      code?: number;
    };

/** What the firmware announces right after the BLE link comes up. */
export interface DeviceBootInfo {
  /** Firmware version string (APP_VERSION_STRING). */
  fw: string;
  /** FastDSP frame rate, Hz. */
  fdspRate: number;
  /** 'fdsp' = product path with the limiter; anything else is a bench build. */
  dacSource: DacSource;
}

export type DeviceEvent =
  | ({ kind: 'event'; event: 'boot' } & DeviceBootInfo)
  | { kind: 'event'; event: 'tone_watchdog' };

export type DeviceMessage = DeviceAck | DeviceEvent;

/** A message plus the moment the app received it, so equal messages still re-trigger UI. */
export interface TimestampedDeviceMessage {
  message: DeviceMessage;
  at: number;
}

export interface LdlResult {
  f0: number;
  /** Level at which the user reported discomfort; null = comfortable up to the safety cap. */
  ldlDb: number | null;
}

/** One completed LDL test run, persisted for history/trend display. */
export interface LdlRun {
  /** ms since epoch, when the run completed. */
  timestamp: number;
  results: LdlResult[];
  /**
   * Firmware version that produced the tones (boot event), so a result can be
   * attributed to a firmware once acoustic calibration exists. Optional so
   * runs persisted before acks existed still load.
   */
  fw?: string;
}

/** One completed "match your sound" run, persisted for history/trend display. */
export interface MatchRun {
  /** ms since epoch, when the run completed. */
  timestamp: number;
  /** Matched pitch, Hz. */
  f0: number;
  /** Matched loudness, dB — null when the user skipped the loudness step. */
  loudnessDb: number | null;
  /** Optional self-rated bother, 0-10 — null if the user skipped it. */
  botherScore: number | null;
  /**
   * True if the final octave check moved the match to f/2 or 2f. Optional so
   * runs persisted before the check existed still load.
   */
  octaveCorrected?: boolean;
  /** Firmware version that played the match tones (boot event), if known. */
  fw?: string;
}

/**
 * An active tolerance-building plan for one band: gradually reduce its
 * attenDb over time, one user-confirmed step at a time. See
 * constants/tolerance.ts for why this exists and what it deliberately
 * doesn't do.
 */
export interface TolerancePlan {
  bandId: string;
  /** Hz, captured at plan start purely for display -- the plan always acts on bandId. */
  f0: number;
  startedAt: number;
  lastStepAt: number;
  stepsCompleted: number;
}

export interface BenchFreqRange {
  lowerHz: number;
  upperHz: number;
}

export interface BleContextValue {
  status: ConnectionStatus;
  /** Payloads waiting to be flushed to the board on (re)connect. */
  queuedCount: number;
  connect: () => void;
  disconnect: () => void;
  sendPayload: (payload: DspPayload) => Promise<void>;

  // ── Device → app messages (NUS TX; see docs/ble-protocol.md) ─────────────
  /** Most recent ack or event, with receive time; null until one arrives. */
  lastMessage: TimestampedDeviceMessage | null;
  /**
   * The connected firmware's boot announcement, null while disconnected or
   * until it arrives. `dacSource !== 'fdsp'` means a bench build with no
   * output limiter — hearing tests must refuse to run (utils/deviceMessages.ts).
   */
  deviceInfo: DeviceBootInfo | null;
  /** Subscribe to every device message as it arrives (hooks that must react without re-render lag). */
  onDeviceMessage: (listener: (message: DeviceMessage) => void) => { remove: () => void };

  // ── nRF5340 DK bench firmware only — see constants/ble.ts. False/null on
  // production hardware, which won't have this service at all. ──────────────
  /** True once the Haven Audio Control Service was found on the connected device. */
  benchAvailable: boolean;
  benchVolume: number | null;
  benchFreqRange: BenchFreqRange | null;
  /** Resolves once the board accepts the write; rejects (out-of-range, etc.) otherwise. */
  setBenchVolume: (percent: number) => Promise<void>;
  setBenchFreqRange: (range: BenchFreqRange) => Promise<void>;
}

// ── Outcome measurement (constants/outcomes.ts) ──────────────────────────────

/** One weekly check-in: two 0–10 visual-analogue ratings. */
export interface VasCheckIn {
  timestamp: number;
  /** "How loud is your sound right now?" 0–10. */
  loudness: number;
  /** "How much does it bother you?" 0–10. */
  bother: number;
}

export type ThiAnswer = 'yes' | 'sometimes' | 'no';

/** One completed Tinnitus Handicap Inventory. */
export interface ThiRun {
  timestamp: number;
  /** 25 answers in item order (utils/thi.ts). */
  answers: ThiAnswer[];
  /** 0–100. */
  total: number;
}

// ── N-of-1 trial (utils/nof1.ts) ─────────────────────────────────────────────

export type TrialArm = 'active' | 'bypass';

export interface TrialOverride {
  timestamp: number;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  assigned: TrialArm;
  chosen: TrialArm;
}

export interface Nof1Trial {
  startedAt: number;
  /** Local calendar day of the first trial day, YYYY-MM-DD. */
  startDay: string;
  /** Arm per trial day, index 0 = startDay. */
  schedule: TrialArm[];
  /** Daily 0–10 bother rating, keyed by day. */
  ratings: Record<string, number>;
  /** Times the user manually switched protection against the day's assignment. */
  overrides: TrialOverride[];
  stoppedAt: number | null;
}

// ── Exposure log (services/ExposureLog.ts) ───────────────────────────────────

export type ExposureEventType =
  | 'connected'
  | 'disconnected'
  | 'bands'
  | 'bypass'
  | 'trial_rating'
  | 'trial_override'
  | 'vas'
  | 'thi';

export interface ExposureEvent {
  timestamp: number;
  type: ExposureEventType;
  /** Small, JSON-serialisable payload; shape depends on `type`. */
  data?: Record<string, unknown>;
}

export interface ConsentRecord {
  acceptedAt: number;
  version: number;
}
