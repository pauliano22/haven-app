import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MONO_FONT, RADIUS, RADIUS_SM, SANS_FONT } from '../../constants/theme';
import { LDL_START_LEVEL_DB, MAX_TONE_LEVEL_DB } from '../../constants/safety';
import { useTheme } from '../../context/ThemeContext';
import { ToneState } from '../../hooks/useLdlTone';
import { SectionRule } from '../SectionRule';

interface Props {
  f0: number;
  stepIndex: number;
  stepCount: number;
  toneState: ToneState;
  levelDb: number;
  /** Big red button — records the LDL and silences the tone. */
  onUncomfortable: () => void;
  /** Skip this frequency without recording a result. */
  onSkip: () => void;
  /** Abort the whole test. */
  onAbort: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`;
}

export function LdlToneStep({
  f0,
  stepIndex,
  stepCount,
  toneState,
  levelDb,
  onUncomfortable,
  onSkip,
  onAbort,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const playing = toneState !== 'idle';
  const range = MAX_TONE_LEVEL_DB - LDL_START_LEVEL_DB;
  const progress = Math.max(0, Math.min(1, (levelDb - LDL_START_LEVEL_DB) / range));

  // The meter glides between ramp steps instead of jumping — the rise should
  // feel as slow and predictable as it actually is.
  const reduceMotion = useReducedMotion();
  const fill = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(progress);
      return;
    }
    Animated.timing(fill, {
      toValue: progress,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, reduceMotion, fill]);
  const fillWidth = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <View style={styles.ruleWrap}>
          <SectionRule label={`Tone ${stepIndex + 1} / ${stepCount}`} hint="rising" />
        </View>
        <Text style={[styles.freq, { color: c.accent }]}>{formatFreq(f0)}</Text>

        <Text style={[styles.stateText, { color: c.textSecondary }]}>
          {toneState === 'ramping' && 'Rising slowly — press STOP when uncomfortable'}
          {toneState === 'held-at-cap' && 'Holding at the safety limit…'}
          {toneState === 'idle' && 'Preparing…'}
        </Text>

        {/* Level meter (capped scale — the bar physically cannot exceed 100%) */}
        <View style={[styles.meterTrack, { backgroundColor: c.sliderMax }]}>
          <Animated.View
            style={[
              styles.meterFill,
              {
                width: fillWidth,
                backgroundColor:
                  toneState === 'held-at-cap' ? c.statusScanning : c.accent,
              },
            ]}
          />
        </View>
        <View style={styles.meterLabels}>
          <Text style={[styles.meterLabel, { color: c.textSecondary }]}>
            {LDL_START_LEVEL_DB} dB
          </Text>
          <Text style={[styles.meterLabel, { fontFamily: MONO_FONT, color: c.textPrimary }]}>
            {Math.round(levelDb)} dB
          </Text>
          <Text style={[styles.meterLabel, { color: c.textSecondary }]}>
            {MAX_TONE_LEVEL_DB} dB MAX
          </Text>
        </View>
      </View>

      {/* The one control that matters: huge, isolated, always reachable. */}
      <TouchableOpacity
        style={[styles.stopBtn, { backgroundColor: c.bypassOff }]}
        onPress={onUncomfortable}
        disabled={!playing}
        activeOpacity={0.85}
      >
        <Text style={styles.stopBtnText}>STOP</Text>
        <Text style={styles.stopBtnSub}>UNCOMFORTABLE</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onSkip}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            Skip tone
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onAbort}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            End test
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
  },
  ruleWrap: {
    alignSelf: 'stretch',
  },
  freq: {
    fontSize: 44,
    fontWeight: '800',
    fontFamily: MONO_FONT,
    marginBottom: 8,
  },
  stateText: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    marginBottom: 18,
    textAlign: 'center',
  },
  meterTrack: {
    width: '100%',
    height: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
  meterLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meterLabel: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    letterSpacing: 0.5,
  },
  stopBtn: {
    minHeight: 130,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 36,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#FFF4E4',
  },
  stopBtnSub: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#FFF4E4',
    opacity: 0.85,
    marginTop: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    fontWeight: '600',
  },
});
