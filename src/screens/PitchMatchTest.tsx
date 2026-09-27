import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LoudnessMatchStep } from '../components/match/LoudnessMatchStep';
import { MatchHistory } from '../components/match/MatchHistory';
import { MatchIntro } from '../components/match/MatchIntro';
import { MatchResults } from '../components/match/MatchResults';
import { OctaveCheckStep } from '../components/match/OctaveCheckStep';
import { PitchTrialStep } from '../components/match/PitchTrialStep';
import { ATTEN_DEFAULT_DB, Q_DEFAULT } from '../constants/dsp';
import { TINNITUS_PRESET_ATTEN_DB, TINNITUS_PRESET_Q } from '../constants/tinnitus';
import { MATCH_BURST_DURATION_MS } from '../constants/safety';
import { SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useBle } from '../context/BleContext';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';
import { usePreviewTone } from '../hooks/usePreviewTone';
import { getLdlHistory } from '../services/LdlHistoryStore';
import { getMatchHistory, saveMatchRun } from '../services/MatchHistoryStore';
import { FilterBand, LdlRun, MatchRun } from '../types';
import { ldlAwareMatchLevels } from '../utils/matchLevel';
import {
  applyOctaveChoice,
  initialBracket,
  isConverged,
  matchedFrequency,
  narrowBracket,
  nextTrialPair,
  octaveCandidates,
  OctaveChoice,
  PitchBracket,
} from '../utils/pitchMatch';

type Phase = 'intro' | 'pitch' | 'octave' | 'loudness' | 'results';

let _matchBandId = 2000;

const NO_OCTAVE_PLAYED: Record<OctaveChoice, boolean> = { lower: false, match: false, upper: false };

interface Props {
  onBack?: () => void;
}

export function PitchMatchTest({ onBack }: Props) {
  const { status } = useBle();
  const { applyBands } = useFilters();
  const { theme } = useTheme();
  const c = theme.colors;
  const { playing, play, stop } = usePreviewTone();

  const connected = status === 'connected';

  const [phase, setPhase] = useState<Phase>('intro');
  const [botherBefore, setBotherBefore] = useState<number | null>(null);
  const [history, setHistory] = useState<MatchRun[]>([]);

  // Tones are capped by the user's own comfort test when one exists -- see
  // utils/matchLevel.ts and docs/safety.md. Loaded once per screen; a test
  // completed on the other Hearing tool is picked up next time this opens.
  const [ldlHistory, setLdlHistory] = useState<LdlRun[]>([]);
  const levels = useMemo(() => ldlAwareMatchLevels(ldlHistory), [ldlHistory]);
  const levelNote =
    levels.cappedByLdlDb !== null
      ? 'Kept quieter than usual because your comfort test found sensitivity.'
      : undefined;

  // ── Pitch matching state ─────────────────────────────────
  const [bracket, setBracket] = useState<PitchBracket>(initialBracket());
  const [trialIndex, setTrialIndex] = useState(0);
  const [playingWhich, setPlayingWhich] = useState<'A' | 'B' | null>(null);
  const [playedA, setPlayedA] = useState(false);
  const [playedB, setPlayedB] = useState(false);
  const trialPair = useMemo(() => nextTrialPair(bracket), [bracket]);

  // ── Octave check state ───────────────────────────────────
  const [octavePlaying, setOctavePlaying] = useState<OctaveChoice | null>(null);
  const [octavePlayed, setOctavePlayed] = useState<Record<OctaveChoice, boolean>>(NO_OCTAVE_PLAYED);
  const [octaveCorrected, setOctaveCorrected] = useState(false);

  // ── Loudness matching + results state ────────────────────
  const [matchedF0, setMatchedF0] = useState(0);
  const [loudnessDb, setLoudnessDb] = useState(levels.loudnessStartDb);
  const [loudnessMatched, setLoudnessMatched] = useState(false);
  const candidates = useMemo(() => octaveCandidates(matchedF0), [matchedF0]);

  useEffect(() => {
    getMatchHistory().then(setHistory);
    getLdlHistory().then(setLdlHistory);
  }, []);

  // If the link drops mid-test, bounce back to intro (mirrors LdlTest).
  useEffect(() => {
    if (phase !== 'intro' && phase !== 'results' && !connected) {
      stop();
      setPhase('intro');
    }
  }, [phase, connected, stop]);

  const resetPitchState = useCallback(() => {
    setBracket(initialBracket());
    setTrialIndex(0);
    setPlayingWhich(null);
    setPlayedA(false);
    setPlayedB(false);
    setOctavePlaying(null);
    setOctavePlayed(NO_OCTAVE_PLAYED);
    setOctaveCorrected(false);
  }, []);

  const handleBegin = useCallback(() => {
    resetPitchState();
    setLoudnessMatched(false);
    setLoudnessDb(levels.loudnessStartDb);
    setPhase('pitch');
  }, [resetPitchState, levels.loudnessStartDb]);

  const handlePlayPitch = useCallback(
    (which: 'A' | 'B') => {
      const f0 = which === 'A' ? trialPair.fA : trialPair.fB;
      const started = play(f0, levels.pitchLevelDb, MATCH_BURST_DURATION_MS, () =>
        setPlayingWhich(null),
      );
      if (!started) return;
      setPlayingWhich(which);
      if (which === 'A') setPlayedA(true);
      else setPlayedB(true);
    },
    [play, trialPair, levels.pitchLevelDb],
  );

  const handleChoosePitch = useCallback(
    (which: 'A' | 'B') => {
      stop();
      const next = narrowBracket(bracket, which);
      const nextTrialCount = trialIndex + 1;

      if (isConverged(next, nextTrialCount)) {
        // Converged -- but not done: one octave check first (utils/pitchMatch.ts).
        setBracket(next);
        setMatchedF0(matchedFrequency(next));
        setOctavePlaying(null);
        setOctavePlayed(NO_OCTAVE_PLAYED);
        setPhase('octave');
        return;
      }

      setBracket(next);
      setTrialIndex(nextTrialCount);
      setPlayingWhich(null);
      setPlayedA(false);
      setPlayedB(false);
    },
    [bracket, trialIndex, stop],
  );

  const handlePlayOctave = useCallback(
    (which: OctaveChoice) => {
      const f0 =
        which === 'lower' ? candidates.lowerHz : which === 'upper' ? candidates.upperHz : matchedF0;
      if (f0 === null) return;
      const started = play(f0, levels.pitchLevelDb, MATCH_BURST_DURATION_MS, () =>
        setOctavePlaying(null),
      );
      if (!started) return;
      setOctavePlaying(which);
      setOctavePlayed((prev) => ({ ...prev, [which]: true }));
    },
    [play, candidates, matchedF0, levels.pitchLevelDb],
  );

  const handleChooseOctave = useCallback(
    (which: OctaveChoice) => {
      stop();
      const recentred = applyOctaveChoice(bracket, which);
      setBracket(recentred);
      setMatchedF0(matchedFrequency(recentred));
      setOctaveCorrected(which !== 'match');
      setPhase('loudness');
    },
    [bracket, stop],
  );

  const handlePreviewLoudness = useCallback(() => {
    play(matchedF0, Math.min(loudnessDb, levels.loudnessMaxDb), MATCH_BURST_DURATION_MS);
  }, [play, matchedF0, loudnessDb, levels.loudnessMaxDb]);

  const finishRun = useCallback(
    (finalLoudnessDb: number | null, matched: boolean) => {
      setLoudnessMatched(matched);
      if (finalLoudnessDb !== null) setLoudnessDb(finalLoudnessDb);
      setPhase('results');
      // A skipped loudness step is stored as null, not as the slider's start
      // value -- history must never show a number nobody measured.
      const run: MatchRun = {
        timestamp: Date.now(),
        f0: matchedF0,
        loudnessDb: finalLoudnessDb,
        botherScore: botherBefore,
        octaveCorrected,
      };
      saveMatchRun(run).then(() => setHistory((prev) => [run, ...prev]));
    },
    [matchedF0, botherBefore, octaveCorrected],
  );

  const handleConfirmLoudness = useCallback(() => {
    finishRun(loudnessDb, true);
  }, [finishRun, loudnessDb]);

  const handleSkipLoudness = useCallback(() => {
    finishRun(null, false);
  }, [finishRun]);

  const handleAbort = useCallback(() => {
    stop();
    setPhase('intro');
  }, [stop]);

  // Width preset: the published notched-sound work uses ~one octave
  // (constants/tinnitus.ts), so that's the default here; "narrow" keeps the
  // Q_DEFAULT the LDL flow uses for external sounds.
  const handleApply = useCallback(
    (width: 'wide' | 'narrow') => {
      const band: FilterBand = {
        id: `match-${_matchBandId++}`,
        f0: matchedF0,
        q: width === 'wide' ? TINNITUS_PRESET_Q : Q_DEFAULT,
        attenDb: width === 'wide' ? TINNITUS_PRESET_ATTEN_DB : ATTEN_DEFAULT_DB,
      };
      applyBands([band]);
      setPhase('intro');
    },
    [matchedF0, applyBands],
  );

  // Keep a stale loudness value from exceeding a cap that arrived after it
  // was set (the LDL history loads asynchronously).
  const loudnessDbRef = useRef(loudnessDb);
  loudnessDbRef.current = loudnessDb;
  useEffect(() => {
    if (loudnessDbRef.current > levels.loudnessMaxDb) setLoudnessDb(levels.loudnessMaxDb);
  }, [levels.loudnessMaxDb]);

  return (
    <View>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backLink} accessibilityRole="button">
          <Text style={[styles.backText, { color: c.textSecondary }]}>‹ All hearing tools</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.title, { color: c.textPrimary }]}>Match your sound</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>
        For a ringing, buzzing, or hissing that isn't really there.
      </Text>

      {phase === 'intro' && (
        <>
          <MatchIntro
            connected={connected}
            botherScore={botherBefore}
            onBotherChange={setBotherBefore}
            onStart={handleBegin}
          />
          <MatchHistory runs={history} />
        </>
      )}

      {phase === 'pitch' && (
        <PitchTrialStep
          trialIndex={trialIndex}
          playingWhich={playingWhich}
          playedA={playedA}
          playedB={playedB}
          levelNote={levelNote}
          onPlay={handlePlayPitch}
          onChoose={handleChoosePitch}
          onAbort={handleAbort}
        />
      )}

      {phase === 'octave' && (
        <OctaveCheckStep
          f0={matchedF0}
          candidates={candidates}
          playingWhich={octavePlaying}
          played={octavePlayed}
          onPlay={handlePlayOctave}
          onChoose={handleChooseOctave}
          onAbort={handleAbort}
        />
      )}

      {phase === 'loudness' && (
        <LoudnessMatchStep
          f0={matchedF0}
          loudnessDb={loudnessDb}
          maxDb={levels.loudnessMaxDb}
          levelNote={levelNote}
          playing={playing}
          onLoudnessChange={setLoudnessDb}
          onPreview={handlePreviewLoudness}
          onConfirm={handleConfirmLoudness}
          onSkip={handleSkipLoudness}
        />
      )}

      {phase === 'results' && (
        <MatchResults
          f0={matchedF0}
          loudnessDb={loudnessMatched ? loudnessDb : null}
          octaveCorrected={octaveCorrected}
          onApply={handleApply}
          onRedo={handleBegin}
          onClose={() => setPhase('intro')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: { marginBottom: 10 },
  backText: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
});
