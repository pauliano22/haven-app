import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LoudnessMatchStep } from '../components/match/LoudnessMatchStep';
import { MatchHistory } from '../components/match/MatchHistory';
import { MatchIntro } from '../components/match/MatchIntro';
import { MatchResults } from '../components/match/MatchResults';
import { PitchTrialStep } from '../components/match/PitchTrialStep';
import { ATTEN_DEFAULT_DB, Q_DEFAULT } from '../constants/dsp';
import {
  MATCH_BURST_DURATION_MS,
  MATCH_LOUDNESS_START_DB,
  MATCH_PITCH_TONE_LEVEL_DB,
} from '../constants/safety';
import { SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useBle } from '../context/BleContext';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';
import { usePreviewTone } from '../hooks/usePreviewTone';
import { getMatchHistory, saveMatchRun } from '../services/MatchHistoryStore';
import { FilterBand, MatchRun } from '../types';
import {
  initialBracket,
  isConverged,
  matchedFrequency,
  narrowBracket,
  nextTrialPair,
  PitchBracket,
} from '../utils/pitchMatch';

type Phase = 'intro' | 'pitch' | 'loudness' | 'results';

let _matchBandId = 2000;

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

  // ── Pitch matching state ─────────────────────────────────
  const [bracket, setBracket] = useState<PitchBracket>(initialBracket());
  const [trialIndex, setTrialIndex] = useState(0);
  const [playingWhich, setPlayingWhich] = useState<'A' | 'B' | null>(null);
  const [playedA, setPlayedA] = useState(false);
  const [playedB, setPlayedB] = useState(false);
  const trialPair = useMemo(() => nextTrialPair(bracket), [bracket]);

  // ── Loudness matching + results state ────────────────────
  const [matchedF0, setMatchedF0] = useState(0);
  const [loudnessDb, setLoudnessDb] = useState(MATCH_LOUDNESS_START_DB);
  const [loudnessMatched, setLoudnessMatched] = useState(false);

  useEffect(() => {
    getMatchHistory().then(setHistory);
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
  }, []);

  const handleBegin = useCallback(() => {
    resetPitchState();
    setLoudnessMatched(false);
    setLoudnessDb(MATCH_LOUDNESS_START_DB);
    setPhase('pitch');
  }, [resetPitchState]);

  const handlePlayPitch = useCallback(
    (which: 'A' | 'B') => {
      const f0 = which === 'A' ? trialPair.fA : trialPair.fB;
      const started = play(f0, MATCH_PITCH_TONE_LEVEL_DB, MATCH_BURST_DURATION_MS, () =>
        setPlayingWhich(null),
      );
      if (!started) return;
      setPlayingWhich(which);
      if (which === 'A') setPlayedA(true);
      else setPlayedB(true);
    },
    [play, trialPair],
  );

  const handleChoosePitch = useCallback(
    (which: 'A' | 'B') => {
      stop();
      const next = narrowBracket(bracket, which);
      const nextTrialCount = trialIndex + 1;

      if (isConverged(next, nextTrialCount)) {
        setMatchedF0(matchedFrequency(next));
        setPhase('loudness');
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

  const handlePreviewLoudness = useCallback(() => {
    play(matchedF0, loudnessDb, MATCH_BURST_DURATION_MS);
  }, [play, matchedF0, loudnessDb]);

  const finishRun = useCallback(
    (finalLoudnessDb: number, matched: boolean) => {
      setLoudnessMatched(matched);
      setLoudnessDb(finalLoudnessDb);
      setPhase('results');
      const run: MatchRun = {
        timestamp: Date.now(),
        f0: matchedF0,
        loudnessDb: finalLoudnessDb,
        botherScore: botherBefore,
      };
      saveMatchRun(run).then(() => setHistory((prev) => [run, ...prev]));
    },
    [matchedF0, botherBefore],
  );

  const handleConfirmLoudness = useCallback(() => {
    finishRun(loudnessDb, true);
  }, [finishRun, loudnessDb]);

  const handleSkipLoudness = useCallback(() => {
    finishRun(MATCH_LOUDNESS_START_DB, false);
  }, [finishRun]);

  const handleAbort = useCallback(() => {
    stop();
    setPhase('intro');
  }, [stop]);

  const handleApply = useCallback(() => {
    const band: FilterBand = {
      id: `match-${_matchBandId++}`,
      f0: matchedF0,
      q: Q_DEFAULT,
      attenDb: ATTEN_DEFAULT_DB,
    };
    applyBands([band]);
    setPhase('intro');
  }, [matchedF0, applyBands]);

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
          onPlay={handlePlayPitch}
          onChoose={handleChoosePitch}
          onAbort={handleAbort}
        />
      )}

      {phase === 'loudness' && (
        <LoudnessMatchStep
          f0={matchedF0}
          loudnessDb={loudnessDb}
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
