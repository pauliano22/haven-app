import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  ATTEN_DEFAULT_DB,
  F0_DEFAULT,
  MAX_BANDS,
  Q_DEFAULT,
} from '../constants/dsp';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { FilterBand, WireFilterBand } from '../types';
import { useBle } from './BleContext';

// Strip UI-only fields and use the uppercase Q key the firmware expects.
function toWireBands(bands: FilterBand[]): WireFilterBand[] {
  return bands.map(b => ({
    f0: b.f0,
    Q: +b.q.toFixed(1),
    atten_db: Math.round(b.attenDb),
  }));
}

let _nextId = 1;
function makeId(): string {
  return String(_nextId++);
}

interface FilterContextValue {
  bands: FilterBand[];
  selectedId: string;
  selectedBand: FilterBand;
  bypass: boolean;
  selectBand: (id: string) => void;
  addBand: () => void;
  removeBand: (id: string) => void;
  /** Patch the selected band and (debounced) push the new set to the device. */
  updateSelected: (patch: Partial<Pick<FilterBand, 'f0' | 'q' | 'attenDb'>>) => void;
  /** Toggle protection: true = bypassed (paused), false = filtering. */
  setBypass: (enabled: boolean) => void;
  /** Replace all bands (LDL results) and push immediately. */
  applyBands: (next: FilterBand[]) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

/**
 * Owns the filter model shared by Home (protection state), Tune (band
 * editing), and Hearing (applying LDL results) — and every send to the device.
 */
export function FilterProvider({ children }: { children: React.ReactNode }) {
  const { sendPayload } = useBle();

  const [bands, setBands] = useState<FilterBand[]>(() => [
    { id: makeId(), f0: F0_DEFAULT, q: Q_DEFAULT, attenDb: ATTEN_DEFAULT_DB },
  ]);
  const [selectedId, setSelectedId] = useState<string>(bands[0].id);
  const [bypass, setBypassState] = useState(false);

  const debouncedSend = useDebouncedCallback((next: FilterBand[]) => {
    sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(next) });
  }, 100);

  const selectBand = useCallback((id: string) => setSelectedId(id), []);

  const addBand = useCallback(() => {
    setBands(prev => {
      if (prev.length >= MAX_BANDS) return prev;
      const band: FilterBand = {
        id: makeId(),
        f0: F0_DEFAULT,
        q: Q_DEFAULT,
        attenDb: ATTEN_DEFAULT_DB,
      };
      setSelectedId(band.id);
      const next = [...prev, band];
      if (!bypass) debouncedSend(next);
      return next;
    });
  }, [bypass, debouncedSend]);

  const removeBand = useCallback(
    (id: string) => {
      setBands(prev => {
        if (prev.length <= 1) return prev;
        const next = prev.filter(b => b.id !== id);
        setSelectedId(sel => (sel === id ? next[0].id : sel));
        if (!bypass) debouncedSend(next);
        return next;
      });
    },
    [bypass, debouncedSend],
  );

  const updateSelected = useCallback(
    (patch: Partial<Pick<FilterBand, 'f0' | 'q' | 'attenDb'>>) => {
      setBands(prev => {
        const next = prev.map(b => (b.id === selectedId ? { ...b, ...patch } : b));
        if (!bypass) debouncedSend(next);
        return next;
      });
    },
    [selectedId, bypass, debouncedSend],
  );

  const setBypass = useCallback(
    (enabled: boolean) => {
      setBypassState(enabled);
      if (enabled) {
        sendPayload({ type: 'BYPASS', enabled: true });
      } else {
        sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(bands) });
      }
    },
    [bands, sendPayload],
  );

  const applyBands = useCallback(
    (next: FilterBand[]) => {
      if (next.length === 0) return;
      setBands(next);
      setSelectedId(next[0].id);
      setBypassState(false);
      sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(next) });
    },
    [sendPayload],
  );

  const selectedBand = bands.find(b => b.id === selectedId) ?? bands[0];

  const value = useMemo(
    () => ({
      bands,
      selectedId,
      selectedBand,
      bypass,
      selectBand,
      addBand,
      removeBand,
      updateSelected,
      setBypass,
      applyBands,
    }),
    [bands, selectedId, selectedBand, bypass, selectBand, addBand, removeBand, updateSelected, setBypass, applyBands],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
