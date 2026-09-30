import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { TrialArm, TrialOverride } from '../../types';
import { SectionRule } from '../SectionRule';

interface Props {
  dayNumber: number;
  totalDays: number;
  assignment: TrialArm | null;
  override: TrialOverride | null;
  rated: boolean;
  complete: boolean;
  onRate: (bother: number) => void;
  onStop: () => void;
  onSeeResults?: () => void;
}

/**
 * Home-screen card for an active N-of-1 trial: today's plan in one line, a
 * one-slider daily rating, and the exit. The orb still works as always —
 * the plan is a suggestion the app follows on connect, and any manual change
 * is recorded as an override (utils/nof1.ts), never prevented.
 */
export function Nof1Card({ dayNumber, totalDays, assignment, override, rated, complete, onRate, onStop, onSeeResults }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [bother, setBother] = useState(5);

  const planLine = complete
    ? 'Your four-week trial is finished.'
    : assignment === 'active'
      ? 'Today’s plan: softening ON.'
      : assignment === 'bypass'
        ? 'Today’s plan: softening PAUSED.'
        : 'Trial starts tomorrow.';

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Your trial" hint={complete ? 'done' : `day ${Math.min(dayNumber, totalDays)} of ${totalDays}`} />
      <Text style={[styles.plan, { color: c.textPrimary }]}>{planLine}</Text>
      {override && !complete && (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          You switched it {override.chosen === 'active' ? 'on' : 'off'} today — that’s fine, today counts as what you chose.
        </Text>
      )}

      {complete ? (
        onSeeResults && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.btnConnectBg }]}
            onPress={onSeeResults}
            accessibilityRole="button"
            accessibilityLabel="See trial results"
          >
            <Text style={[styles.primaryText, { color: c.btnConnectText }]}>See what it showed</Text>
          </TouchableOpacity>
        )
      ) : rated ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>Rated today — thank you. Come back tomorrow.</Text>
      ) : (
        <>
          <Text style={[styles.question, { color: c.textPrimary }]}>How much did your sound bother you today?</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={10}
            step={1}
            value={bother}
            onValueChange={(v) => setBother(Math.round(v))}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={c.accent}
            accessibilityLabel="How much your sound bothered you today, 0 to 10"
          />
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Not at all</Text>
            <Text style={[styles.value, { color: c.accent }]}>{bother}</Text>
            <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>Extremely</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.btnConnectBg }]}
            onPress={() => onRate(bother)}
            accessibilityRole="button"
            accessibilityLabel="Save today's rating"
          >
            <Text style={[styles.primaryText, { color: c.btnConnectText }]}>Save today’s rating</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={onStop} accessibilityRole="button" accessibilityLabel={complete ? 'Clear this trial' : 'Stop the trial'}>
        <Text style={[styles.stopLink, { color: c.textSecondary }]}>{complete ? 'Clear trial' : 'Stop trial'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginTop: 20 },
  plan: { fontSize: 17, fontFamily: SERIF_FONT, marginBottom: 8 },
  note: { fontSize: 12.5, fontFamily: SANS_FONT, lineHeight: 18, marginBottom: 10 },
  question: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600', marginTop: 4 },
  slider: { width: '100%', height: 40 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rangeLabel: { fontSize: 11, fontFamily: SANS_FONT },
  value: { fontSize: 15, fontFamily: SERIF_FONT },
  primaryBtn: { borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontSize: 13.5, fontFamily: SANS_FONT, fontWeight: '700' },
  stopLink: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 12,
  },
});
