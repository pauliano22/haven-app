import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConnectionBar } from '../components/ConnectionBar';
import { MONO_FONT } from '../constants/theme';
import { LdlIntro } from '../components/ldl/LdlIntro';
import { LdlResults, SENSITIVE_LDL_THRESHOLD_DB } from '../components/ldl/LdlResults';
import { LdlToneStep } from '../components/ldl/LdlToneStep';
import {
  ATTEN_MAX_DB,
  ATTEN_MIN_DB,
  MAX_BANDS,
  Q_DEFAULT,
} from '../constants/dsp';
import { LDL_TEST_FREQUENCIES_HZ, MAX_TONE_LEVEL_DB } from '../constants/safety';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { ToneStopInfo, useLdlTone } from '../hooks/useLdlTone';
import { FilterBand, LdlResult } from '../types';

type Phase = 'intro' | 'testing' | 'results';

interface Props {
  onClose: () => void;
  /** Deliver dampening bands derived from the results back to the dashboard. */
  onApplyBands: (bands: FilterBand[]) => void;
}

let _ldlBandId = 1000;

/**
 * Map a sensitive frequency to a dampening band: the lower the discomfort
 * level, the deeper the cut, clamped to the DSP's attenuation range.
 */
function resultsToBands(results: LdlResult[]): FilterBand[] {
  return results
    .filter((r): r is LdlResult & { ldlDb: number } =>
      r.ldlDb !== null && r.ldlDb <= SENSITIVE_LDL_THRESHOLD_DB,
    )
    .sort((a, b) => a.ldlDb - b.ldlDb)
    .slice(0, MAX_BANDS)
    .map((r) => ({
      id: `ldl-${_ldlBandId++}`,
      f0: r.f0,
      q: Q_DEFAULT,
      attenDb: Math.min(
        ATTEN_MAX_DB,
        Math.max(ATTEN_MIN_DB, MAX_TONE_LEVEL_DB - r.ldlDb + 5),
      ),
    }));
}

export function LdlTest({ onClose, onApplyBands }: Props) {
  const { status } = useBle();
  const { theme } = useTheme();
  const c = theme.colors;
  const { toneState, levelDb, start, stop } = useLdlTone();

  const [phase, setPhase] = useState<Phase>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState<LdlResult[]>([]);
  const stepIndexRef = useRef(0);

  const connected = status === 'connected';
  const frequencies = LDL_TEST_FREQUENCIES_HZ;

  const advance = useCallback(
    (result: LdlResult | null) => {
      if (result) setResults((prev) => [...prev, result]);

      const next = stepIndexRef.current + 1;
      if (next >= frequencies.length) {
        setPhase('results');
      } else {
        stepIndexRef.current = next;
        setStepIndex(next);
      }
    },
    [frequencies.length],
  );

  const startCurrentTone = useCallback(() => {
    const f0 = frequencies[stepIndexRef.current];
    const ok = start(f0, (info: ToneStopInfo) => {
      // Auto-stop (safety cap / fail-safe): comfortable up to the limit.
      advance({ f0, ldlDb: info.cappedOut ? null : info.levelDb });
    });
    if (!ok) setPhase('intro'); // link dropped between screens
  }, [frequencies, start, advance]);

  // Kick off each tone when entering/advancing through the testing phase.
  useEffect(() => {
    if (phase === 'testing') startCurrentTone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex]);

  // If the link drops mid-test the tone is already stopped by the hook;
  // bounce back to the intro so the user re-starts deliberately.
  useEffect(() => {
    if (phase === 'testing' && !connected) setPhase('intro');
  }, [phase, connected]);

  const handleBegin = useCallback(() => {
    setResults([]);
    stepIndexRef.current = 0;
    setStepIndex(0);
    setPhase('testing');
  }, []);

  const handleUncomfortable = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    const info = stop();
    advance({ f0: frequencies[stepIndexRef.current], ldlDb: info.levelDb });
  }, [stop, advance, frequencies]);

  const handleSkip = useCallback(() => {
    stop();
    advance(null);
  }, [stop, advance]);

  const handleAbort = useCallback(() => {
    stop();
    setPhase(results.length > 0 ? 'results' : 'intro');
  }, [stop, results.length]);

  const handleApply = useCallback(() => {
    onApplyBands(resultsToBands(results));
    onClose();
  }, [results, onApplyBands, onClose]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { stop(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.backLink, { color: c.accent }]}>‹ Dashboard</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.textSecondary }]}>LDL TEST</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ConnectionBar />

        {phase === 'intro' && <LdlIntro connected={connected} onStart={handleBegin} />}

        {phase === 'testing' && (
          <LdlToneStep
            f0={frequencies[stepIndex]}
            stepIndex={stepIndex}
            stepCount={frequencies.length}
            toneState={toneState}
            levelDb={levelDb}
            onUncomfortable={handleUncomfortable}
            onSkip={handleSkip}
            onAbort={handleAbort}
          />
        )}

        {phase === 'results' && (
          <LdlResults
            results={results}
            onApply={handleApply}
            onRedo={handleBegin}
            onClose={onClose}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backLink: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    letterSpacing: 3,
  },
  headerSpacer: {
    width: 70,
  },
});
