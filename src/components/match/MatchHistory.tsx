import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { MatchRun } from '../../types';
import { SectionRule } from '../SectionRule';

interface Props {
  runs: MatchRun[];
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Trend across runs that recorded a bother score, oldest to newest. */
function trendLabel(scores: number[]): string {
  if (scores.length < 2) return '';
  const first = scores[0];
  const last = scores[scores.length - 1];
  if (last < first) return '↓ less bothersome';
  if (last > first) return '↑ more bothersome';
  return '→ steady';
}

export function MatchHistory({ runs }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (runs.length === 0) return null;

  const chronological = [...runs].reverse();
  const scores = chronological
    .map((r) => r.botherScore)
    .filter((s): s is number => s !== null);
  const trend = trendLabel(scores);
  const recent = [...runs].slice(0, 5);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Past matches" hint={`${runs.length} run${runs.length === 1 ? '' : 's'}`} />

      {trend !== '' && (
        <Text style={[styles.trend, { color: c.textSecondary }]}>{trend}</Text>
      )}

      {recent.map((run, i) => (
        <View
          key={run.timestamp}
          style={[
            styles.row,
            i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.borderDeep },
          ]}
        >
          <Text style={[styles.rowDate, { color: c.textPrimary }]}>{formatDate(run.timestamp)}</Text>
          <Text style={[styles.rowSummary, { color: c.textSecondary }]}>
            {formatFreq(run.f0)}
            {run.botherScore !== null ? ` · bother ${run.botherScore}/10` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
    marginTop: 16,
  },
  trend: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowDate: {
    fontSize: 14,
    fontFamily: SERIF_FONT,
  },
  rowSummary: {
    fontSize: 12,
    fontFamily: SANS_FONT,
  },
});
