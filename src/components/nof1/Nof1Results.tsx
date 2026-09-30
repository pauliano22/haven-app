import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NOF1_MIN_DAYS_PER_ARM } from '../../constants/outcomes';
import { RADIUS, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { TrialSummary } from '../../utils/nof1';
import { SectionRule } from '../SectionRule';

interface Props {
  summary: TrialSummary;
  complete: boolean;
}

/** Two numbers and one honest sentence (utils/nof1.ts writes the sentence). */
export function Nof1Results({ summary, complete }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const fmt = (m: number | null) => (m === null ? '—' : m.toFixed(1));

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Trial results" hint={complete ? 'complete' : 'so far'} />
      <View style={styles.arms}>
        <View style={styles.arm}>
          <Text style={[styles.armLabel, { color: c.textSecondary }]}>Softening on</Text>
          <Text style={[styles.armValue, { color: c.accent }]}>{fmt(summary.active.mean)}</Text>
          <Text style={[styles.armN, { color: c.textSecondary }]}>{summary.active.n} day{summary.active.n === 1 ? '' : 's'}</Text>
        </View>
        <View style={styles.arm}>
          <Text style={[styles.armLabel, { color: c.textSecondary }]}>Paused</Text>
          <Text style={[styles.armValue, { color: c.accent }]}>{fmt(summary.bypass.mean)}</Text>
          <Text style={[styles.armN, { color: c.textSecondary }]}>{summary.bypass.n} day{summary.bypass.n === 1 ? '' : 's'}</Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: c.textSecondary }]}>average daily bother, 0–10 (lower is better)</Text>
      <Text style={[styles.sentence, { color: c.textPrimary }]}>{summary.sentence}</Text>
      {!summary.sufficient && (
        <Text style={[styles.caveat, { color: c.textSecondary }]}>
          The app won’t compare the two until each has at least {NOF1_MIN_DAYS_PER_ARM} rated days —
          fewer than that and a couple of unusual days would decide the answer.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  arms: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  arm: { flex: 1, alignItems: 'center' },
  armLabel: { fontSize: 11, fontFamily: SANS_FONT, textTransform: 'uppercase', letterSpacing: 1 },
  armValue: { fontSize: 34, fontFamily: SERIF_FONT, marginVertical: 2 },
  armN: { fontSize: 11, fontFamily: SANS_FONT },
  caption: { fontSize: 11, fontFamily: SANS_FONT, textAlign: 'center', marginBottom: 12 },
  sentence: { fontSize: 14, fontFamily: SANS_FONT, lineHeight: 21 },
  caveat: { fontSize: 12, fontFamily: SANS_FONT, lineHeight: 17, marginTop: 10 },
});
