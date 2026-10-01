import { useCallback, useRef, useState } from 'react';
import { ATTEN_MAX_DB, ATTEN_MIN_DB, Q_MAX, Q_MIN } from '../constants/dsp';
import { useFilters } from '../context/FilterContext';
import * as search from '../utils/preferenceSearch';

// Coarse, hand-picked grids across each dimension's real range (see
// constants/dsp.ts) -- not learned, not derived from any dataset. See
// preferenceSearch.ts for why a short discrete list rather than the full
// continuous range.
const ATTEN_CANDIDATES: readonly number[] = [3, 9, 15, 21, 28, 34, 40];
const Q_CANDIDATES: readonly number[] = [1, 3, 6, 10, 14, 17, 20];

if (ATTEN_CANDIDATES[0] < ATTEN_MIN_DB || ATTEN_CANDIDATES[ATTEN_CANDIDATES.length - 1] > ATTEN_MAX_DB) {
  throw new Error('ATTEN_CANDIDATES out of range vs constants/dsp.ts');
}
if (Q_CANDIDATES[0] < Q_MIN || Q_CANDIDATES[Q_CANDIDATES.length - 1] > Q_MAX) {
  throw new Error('Q_CANDIDATES out of range vs constants/dsp.ts');
}

export type TunerPhase = 'depth' | 'width' | 'done';

export interface TunerPair {
  a: number;
  b: number;
}

export interface BandTunerState {
  /** True once start() has been called and hasn't finished or been cancelled. */
  active: boolean;
  phase: TunerPhase;
  /** 1-based count of comparisons answered so far this session. */
  comparisonCount: number;
  /** The pair currently being compared, or null when not active/done. */
  pair: TunerPair | null;
  /** Which of the current pair is live on the device right now. */
  activeChoice: 'a' | 'b' | null;
  start: () => void;
  /** Switch the live filter to hear option 'a' or 'b' again before deciding. */
  playOption: (which: 'a' | 'b') => void;
  choose: (pick: search.PreferenceChoice) => void;
  /** Abandon the session and restore whatever the band had before start(). */
  cancel: () => void;
}

/**
 * Drives a two-phase preference search (softening depth, then width) for
 * one band, applying each candidate live via the same `updateBand()` path
 * manual tuning already uses -- no new BLE messages, no new safety surface:
 * every value this ever sends is already clamped by the existing
 * FilterBand/wire-format rules (see types/index.ts, context/FilterContext.tsx),
 * and it never touches TONE_* / LDL code at all. Frequency (f0) is left
 * untouched throughout -- *which* frequency to soften is decided by the
 * LDL/pitch-match tests or manual tuning, not this search. See
 * ML_RL_FEASIBILITY.md (haven-zephyr-app) for the full reasoning.
 */
export function useBandTuner(bandId: string): BandTunerState {
  const { bands, updateBand } = useFilters();

  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<TunerPhase>('depth');
  const [depthState, setDepthState] = useState<search.SearchState | null>(null);
  const [widthState, setWidthState] = useState<search.SearchState | null>(null);
  const [activeChoice, setActiveChoice] = useState<'a' | 'b' | null>(null);
  const [comparisonCount, setComparisonCount] = useState(0);
  const snapshot = useRef<{ attenDb: number; q: number } | null>(null);

  const currentSearchState = phase === 'depth' ? depthState : phase === 'width' ? widthState : null;
  const pair = currentSearchState ? search.currentPair(currentSearchState) : null;

  // `forPhase` is explicit rather than read from the `phase` state: when the
  // depth search converges, advanceToWidthPhase() applies the first WIDTH
  // candidate in the same render in which setPhase('width') is still
  // pending, so a closure over `phase` would see 'depth' and write a Q value
  // (e.g. 6) into attenDb -- the device would end up at 6 dB softening
  // instead of the depth the person just chose. Caught in review of PR #10.
  const applyCandidate = useCallback(
    (forPhase: 'depth' | 'width', value: number, which: 'a' | 'b') => {
      if (forPhase === 'depth') updateBand(bandId, { attenDb: value });
      else updateBand(bandId, { q: value });
      setActiveChoice(which);
    },
    [bandId, updateBand],
  );

  const start = useCallback(() => {
    const band = bands.find((b) => b.id === bandId);
    if (!band) return;
    snapshot.current = { attenDb: band.attenDb, q: band.q };

    const s = search.createSearch(ATTEN_CANDIDATES);
    setDepthState(s);
    setWidthState(null);
    setPhase('depth');
    setComparisonCount(0);
    setActive(true);

    const p = search.currentPair(s);
    if (p) {
      updateBand(bandId, { attenDb: p.a });
      setActiveChoice('a');
    }
  }, [bands, bandId, updateBand]);

  const playOption = useCallback(
    (which: 'a' | 'b') => {
      if (!pair || phase === 'done') return;
      applyCandidate(phase, which === 'a' ? pair.a : pair.b, which);
    },
    [pair, phase, applyCandidate],
  );

  const advanceToWidthPhase = useCallback(() => {
    const ws = search.createSearch(Q_CANDIDATES);
    setWidthState(ws);
    setPhase('width');
    const p = search.currentPair(ws);
    if (p) applyCandidate('width', p.a, 'a');
  }, [applyCandidate]);

  const finish = useCallback(
    (finalQ: number) => {
      updateBand(bandId, { q: finalQ });
      setPhase('done');
      setActive(false);
      setActiveChoice(null);
    },
    [bandId, updateBand],
  );

  const choose = useCallback(
    (pick: search.PreferenceChoice) => {
      if (phase === 'depth' && depthState) {
        const next = search.choose(depthState, pick);
        setComparisonCount((n) => n + 1);
        if (search.isDone(next)) {
          updateBand(bandId, { attenDb: search.result(next) });
          setDepthState(next);
          advanceToWidthPhase();
        } else {
          setDepthState(next);
          const p = search.currentPair(next);
          if (p) applyCandidate('depth', p.a, 'a');
        }
      } else if (phase === 'width' && widthState) {
        const next = search.choose(widthState, pick);
        setComparisonCount((n) => n + 1);
        if (search.isDone(next)) {
          setWidthState(next);
          finish(search.result(next));
        } else {
          setWidthState(next);
          const p = search.currentPair(next);
          if (p) applyCandidate('width', p.a, 'a');
        }
      }
    },
    [phase, depthState, widthState, bandId, updateBand, advanceToWidthPhase, applyCandidate, finish],
  );

  const cancel = useCallback(() => {
    if (snapshot.current) {
      updateBand(bandId, { attenDb: snapshot.current.attenDb, q: snapshot.current.q });
    }
    setActive(false);
    setPhase('depth');
    setDepthState(null);
    setWidthState(null);
    setActiveChoice(null);
  }, [bandId, updateBand]);

  return { active, phase, comparisonCount, pair: pair ?? null, activeChoice, start, playOption, choose, cancel };
}
