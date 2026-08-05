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
}

/** Wire format the firmware parses — uppercase Q, no UI-only fields. */
export interface WireFilterBand {
  f0: number;
  Q: number;
}

export interface FilterPayload {
  type: 'MULTI_FILTER';
  bands: WireFilterBand[];
}

export interface BypassPayload {
  type: 'BYPASS';
  enabled: boolean;
}

export type DspPayload = FilterPayload | BypassPayload;

export interface BleContextValue {
  status: ConnectionStatus;
  /** Payloads waiting to be flushed to the board on (re)connect. */
  queuedCount: number;
  connect: () => void;
  disconnect: () => void;
  sendPayload: (payload: DspPayload) => Promise<void>;
}
