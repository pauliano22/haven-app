import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MATCH_LOUDNESS_MAX_DB, MATCH_LOUDNESS_MIN_DB } from '../../constants/safety';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  f0: number;
  loudnessDb: number;
  playing: boolean;
  onLoudnessChange: (value: number) => void;
  onPreview: () => void;
  onConfirm: () => void;
  onSkip: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`;
}

export function LoudnessMatchStep({
  f0,
  loudnessDb,
  playing,
  onLoudnessChange,
  onPreview,
  onConfirm,
  onSkip,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <SectionRule label="One more thing" hint="loudness" />
        <Text style={[styles.instruction, { color: c.textPrimary }]}>
          Now match how loud it seems. Move the slider, then play the sound
          at {formatFreq(f0)} to compare.
        </Text>

        <Text style={[styles.loudnessValue, { color: c.accent }]}>
          {Math.round(loudnessDb)} dB
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={MATCH_LOUDNESS_MIN_DB}
          maximumValue={MATCH_LOUDNESS_MAX_DB}
          step={1}
          value={loudnessDb}
          onValueChange={onLoudnessChange}
          minimumTrackTintColor={c.accent}
          maximumTrackTintColor={c.sliderMax}
          thumbTintColor={c.accent}
          accessibilityLabel="Loudness to match, in decibels"
        />
        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Very quiet</Text>
          <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Clearly loud</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.playBtn,
            { backgroundColor: playing ? c.sliderDisabled : c.btnConnectBg },
          ]}
          onPress={onPreview}
          disabled={playing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Play sound at current loudness"
        >
          <Text style={[styles.playBtnText, { color: c.btnConnectText }]}>
            {playing ? 'Playing…' : '▶ Play at this level'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: c.btnConnectBg }]}
        onPress={onConfirm}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="This loudness matches"
      >
        <Text style={[styles.confirmText, { color: c.btnConnectText }]}>That matches</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.skipBtn, { borderColor: c.border }]}
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip loudness matching"
      >
        <Text style={[styles.skipText, { color: c.textSecondary }]}>
          Not sure — skip this part
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
  },
  instruction: {
    fontSize: 15,
    fontFamily: SERIF_FONT,
    lineHeight: 22,
    marginBottom: 14,
  },
  loudnessValue: {
    fontSize: 36,
    fontFamily: SERIF_FONT,
    textAlign: 'center',
    marginBottom: 4,
  },
  slider: { width: '100%', height: 44 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  rangeLabel: {
    fontSize: 11,
    fontFamily: SANS_FONT,
  },
  playBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 15,
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: 14,
    fontFamily: SANS_FONT,
    fontWeight: '700',
  },
  confirmBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skipBtn: {
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 13,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
});
