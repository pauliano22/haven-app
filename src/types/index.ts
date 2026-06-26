export type ConnectionStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected';

export interface FilterPayload {
  type: 'FILTER_UPDATE';
  f0: number;
  Q: number;
}

export interface BypassPayload {
  type: 'BYPASS';
  enabled: boolean;
}

export type DspPayload = FilterPayload | BypassPayload;

export interface BleContextValue {
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  sendPayload: (payload: DspPayload) => Promise<void>;
}
