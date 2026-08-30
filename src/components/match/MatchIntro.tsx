import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  connected: boolean;
  botherScore: number | null;
  onBotherChange: (value: number | null) => void;
  onStart: () => void;
}

export function MatchIntro({ connected, botherScore, onBotherChange, onStart }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Match your sound" hint="guided" />
      <Text style={[styles.title, { color: c.textPrimary }]}>
        Find the pitch.{'\n'}Then try softening it.
      </Text>

      <Text style={[styles.body, { color: c.textSecondary }]}>
        If you hear a ringing, buzzing, or hissing that isn't really there,
        this finds the pitch that's closest to it by playing pairs of short
        sounds and asking which one is closer. It usually takes about a
        minute.
      </Text>

      <Text
        style={[styles.body, { color: c.textSecondary }]}
        accessibilityRole="text"
      >
        There's no proven cure for this kind of sound, but many people find
        it easier to ignore once the closest frequency is gently softened —
        and tracking it over time can help you and a doctor see what's
        actually working for you.
      </Text>

      <View style={styles.botherWrap}>
        <Text style={[styles.botherLabel, { color: c.textPrimary }]}>
          How bothersome is it right now? <Text style={{ color: c.textSecondary }}>(optional)</Text>
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={10}
          step={1}
          value={botherScore ?? 0}
          onValueChange={(v) => onBotherChange(Math.round(v))}
          minimumTrackTintColor={c.accent}
          maximumTrackTintColor={c.sliderMax}
          thumbTintColor={c.accent}
          accessibilityLabel="How bothersome is the sound right now, from 0 to 10"
        />
        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Not at all</Text>
          <Text style={[styles.botherValue, { color: c.accent }]}>
            {botherScore ?? '—'}
          </Text>
          <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Extremely</Text>
        </View>
      </View>

      <View style={[styles.safetyBox, { borderColor: c.statusScanning }]}>
        <Text style={[styles.safetyTitle, { color: c.statusScanning }]}>
          Safety limits active
        </Text>
        <Text style={[styles.safetyText, { color: c.textSecondary }]}>
          Every sound here is short, quiet, and capped well below the level
          used in the loudness comfort test — nothing approaches discomfort.
        </Text>
      </View>

      {!connected && (
        <Text style={[styles.warn, { color: c.statusDisconnected }]}>
          Connect to your Haven device to begin.
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.startBtn,
          { backgroundColor: connected ? c.btnConnectBg : c.sliderDisabled },
        ]}
        disabled={!connected}
        onPress={onStart}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Begin matching your sound"
      >
        <Text style={[styles.startBtnText, { color: c.btnConnectText }]}>
          Begin
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
  },
  title: {
    fontSize: 26,
    fontFamily: SERIF_FONT,
    letterSpacing: 0,
    lineHeight: 33,
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    fontFamily: SANS_FONT,
    lineHeight: 22,
    marginBottom: 12,
  },
  botherWrap: {
    marginTop: 4,
    marginBottom: 16,
  },
  botherLabel: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 11,
    fontFamily: SANS_FONT,
  },
  botherValue: {
    fontSize: 15,
    fontFamily: SERIF_FONT,
  },
  safetyBox: {
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    padding: 14,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  safetyText: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    lineHeight: 18,
  },
  warn: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  startBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 15,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
