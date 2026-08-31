import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TOLERANCE_STEP_DB, TOLERANCE_STEP_INTERVAL_MS } from '../constants/tolerance';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { TolerancePlan } from '../types';
import { SectionRule } from './SectionRule';

interface Props {
  plan: TolerancePlan;
  currentAttenDb: number;
  dueForStep: boolean;
  onAdvance: () => void;
  onStop: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`;
}

function daysUntilDue(plan: TolerancePlan): number {
  const remaining = TOLERANCE_STEP_INTERVAL_MS - (Date.now() - plan.lastStepAt);
  return Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export function TolerancePlanCard({ plan, currentAttenDb, dueForStep, onAdvance, onStop }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nextAttenDb = Math.max(0, currentAttenDb - TOLERANCE_STEP_DB);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule
        label="Building tolerance"
        hint={`${formatFreq(plan.f0)} · step ${plan.stepsCompleted + 1}`}
      />

      {dueForStep ? (
        <>
          <Text style={[styles.question, { color: c.textPrimary }]}>
            Ready to soften this a little less?
          </Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Currently softened by {Math.round(currentAttenDb)} dB. The next step brings that
            down to {Math.round(nextAttenDb)} dB. Only do this if it's felt manageable so far.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: c.btnConnectBg }]}
              onPress={onAdvance}
              accessibilityRole="button"
              accessibilityLabel="Reduce softening by one step"
            >
              <Text style={[styles.primaryText, { color: c.btnConnectText }]}>Reduce it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: c.border }]}
              onPress={onStop}
              accessibilityRole="button"
              accessibilityLabel="Stop the tolerance-building plan"
            >
              <Text style={[styles.secondaryText, { color: c.textSecondary }]}>Stop plan</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Next step available in {daysUntilDue(plan)} day{daysUntilDue(plan) === 1 ? '' : 's'}.
            Currently softened by {Math.round(currentAttenDb)} dB.
          </Text>
          <TouchableOpacity onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop the tolerance-building plan">
            <Text style={[styles.stopLink, { color: c.textSecondary }]}>Stop plan</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  question: {
    fontSize: 17,
    fontFamily: SERIF_FONT,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    lineHeight: 19,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 13.5,
    fontFamily: SANS_FONT,
    fontWeight: '700',
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
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
  stopLink: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
