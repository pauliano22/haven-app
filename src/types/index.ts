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
