import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ATTEN_DEFAULT_DB,
  F0_DEFAULT,
  MAX_BANDS,
  Q_DEFAULT,
} from '../constants/dsp';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { logExposure } from '../services/ExposureLog';
import { getFilterProfile, saveFilterProfile } from '../services/FilterStore';
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
  /** Patch an arbitrary band by id (e.g. a tolerance-plan step on a band that
   * isn't currently selected on Tune) and (debounced) push the new set. */
  updateBand: (id: string, patch: Partial<Pick<FilterBand, 'f0' | 'q' | 'attenDb'>>) => void;
  /** Toggle protection: true = bypassed (paused), false = filtering. */
  setBypass: (enabled: boolean) => void;
  /** Replace all bands (LDL results) and push immediately. */
  applyBands: (next: FilterBand[]) => void;
  /**
   * ms timestamp of the last time the device refused a filter/bypass change
   * (`ok:false` ack) and the UI was rolled back to the last confirmed state;
   * null if that has never happened. Home shows a quiet toast off this.
   */
  lastRejectedAt: number | null;
}

const FilterContext = createContext<FilterContextValue | null>(null);

/**
 * Owns the filter model shared by Home (protection state), Tune (band
 * editing), and Hearing (applying LDL results) — and every send to the device.
 */
export function FilterProvider({ children }: { children: React.ReactNode }) {
  const { status, sendPayload, onDeviceMessage } = useBle();

  const [bands, setBands] = useState<FilterBand[]>(() => [
    { id: makeId(), f0: F0_DEFAULT, q: Q_DEFAULT, attenDb: ATTEN_DEFAULT_DB },
  ]);
  const [selectedId, setSelectedId] = useState<string>(bands[0].id);
  const [bypass, setBypassState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastRejectedAt, setLastRejectedAt] = useState<number | null>(null);

  // Device acks (docs/ble-protocol.md). The UI applies every edit
  // optimistically; if the device answers a MULTI_FILTER/BYPASS with
  // `ok:false` we roll back to the last state it *did* confirm, so the
  // screen never claims a softening the codec isn't doing. Acks are
  // best-effort, so a missing ack changes nothing -- only an explicit refusal
  // does. `pendingRef` is what the most recent send described; `committedRef`
  // is the last pending state an ok ack confirmed.
  const pendingRef = useRef<{ bands: FilterBand[]; bypass: boolean } | null>(null);
  const committedRef = useRef<{ bands: FilterBand[]; bypass: boolean } | null>(null);
  const noteSent = useCallback((next: FilterBand[], nextBypass: boolean) => {
    pendingRef.current = { bands: next, bypass: nextBypass };
  }, []);
  useEffect(() => {
    const sub = onDeviceMessage((message) => {
      if (message.kind !== 'ack') return;
      if (message.cmd !== 'MULTI_FILTER' && message.cmd !== 'BYPASS') return;
      if (message.ok) {
        if (pendingRef.current) committedRef.current = pendingRef.current;
        return;
      }
      const committed = committedRef.current;
      if (committed) {
        setBands(committed.bands);
        setSelectedId((sel) => (committed.bands.some((b) => b.id === sel) ? sel : committed.bands[0].id));
        setBypassState(committed.bypass);
        pendingRef.current = committed;
      }
      setLastRejectedAt(Date.now());
    });
    return () => sub.remove();
  }, [onDeviceMessage]);

  // Every band set that reaches the device is also logged (consent-gated
  // inside logExposure) -- the outcome check-ins are meaningless without
  // knowing what was being softened at the time.
  const logBands = useCallback((next: FilterBand[]) => {
    logExposure('bands', { bands: next.map((b) => ({ f0: b.f0, q: b.q, atten: b.attenDb })) });
  }, []);

  const debouncedSend = useDebouncedCallback((next: FilterBand[]) => {
    sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(next) });
    noteSent(next, false);
    logBands(next);
  }, 100);

  // Same reasoning as debouncedSend above: a slider drag fires many bands
  // updates per second, and every one of those would otherwise be a
  // separate AsyncStorage write.
  const debouncedSave = useDebouncedCallback((nextBands: FilterBand[], nextBypass: boolean) => {
    saveFilterProfile({ bands: nextBands, bypass: nextBypass });
  }, 400);

  // Load the last saved profile once on startup, so bands/bypass survive
  // an app relaunch instead of resetting to the single default band.
  useEffect(() => {
    getFilterProfile().then((profile) => {
      if (profile) {
        setBands(profile.bands);
        setSelectedId(profile.bands[0].id);
        setBypassState(profile.bypass);
      }
      setHydrated(true);
    });
    // Runs once — deliberately not re-triggered by anything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change (debounced), once hydration has settled (so we
  // never overwrite the saved profile with the transient pre-hydration
  // default).
  useEffect(() => {
    if (!hydrated) return;
    debouncedSave(bands, bypass);
    // debouncedSave is stable (useDebouncedCallback wraps it in a ref), so
    // omitting it here doesn't skip any real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, bands, bypass]);

  // Push the saved profile to a freshly connected device once per
  // connection, so reconnecting doesn't leave the device on whatever it
  // last had (or its own default) instead of the user's chosen settings.
  const syncedThisConnectionRef = useRef(false);
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (status !== 'connected') {
      if (wasConnectedRef.current) {
        wasConnectedRef.current = false;
        logExposure('disconnected');
      }
      syncedThisConnectionRef.current = false;
      return;
    }
    if (!wasConnectedRef.current) {
      wasConnectedRef.current = true;
      logExposure('connected', { bypass, bands: bands.length });
    }
    if (!hydrated || syncedThisConnectionRef.current) return;
    syncedThisConnectionRef.current = true;
    // A fresh link starts with no confirmed state: the first ok ack sets it.
    committedRef.current = null;
    noteSent(bands, bypass);
    if (bypass) {
      sendPayload({ type: 'BYPASS', enabled: true });
    } else {
      sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(bands) });
      logBands(bands);
    }
    // Deliberately re-checks bands/bypass only via the ref guard above —
    // this should fire once per connection, not on every subsequent edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hydrated]);

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

  const updateBand = useCallback(
    (id: string, patch: Partial<Pick<FilterBand, 'f0' | 'q' | 'attenDb'>>) => {
      setBands(prev => {
        const next = prev.map(b => (b.id === id ? { ...b, ...patch } : b));
        if (!bypass) debouncedSend(next);
        return next;
      });
    },
    [bypass, debouncedSend],
  );

  const updateSelected = useCallback(
    (patch: Partial<Pick<FilterBand, 'f0' | 'q' | 'attenDb'>>) => updateBand(selectedId, patch),
    [selectedId, updateBand],
  );

  const setBypass = useCallback(
    (enabled: boolean) => {
      setBypassState(enabled);
      logExposure('bypass', { enabled });
      noteSent(bands, enabled);
      if (enabled) {
        sendPayload({ type: 'BYPASS', enabled: true });
      } else {
        sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(bands) });
        logBands(bands);
      }
    },
    [bands, sendPayload, logBands, noteSent],
  );

  const applyBands = useCallback(
    (next: FilterBand[]) => {
      if (next.length === 0) return;
      setBands(next);
      setSelectedId(next[0].id);
      setBypassState(false);
      sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(next) });
      noteSent(next, false);
      logBands(next);
    },
    [sendPayload, logBands, noteSent],
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
      updateBand,
      setBypass,
      applyBands,
      lastRejectedAt,
    }),
    [bands, selectedId, selectedBand, bypass, selectBand, addBand, removeBand, updateSelected, updateBand, setBypass, applyBands, lastRejectedAt],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
