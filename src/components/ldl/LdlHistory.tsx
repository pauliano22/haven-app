import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { LdlRun } from '../../types';
import { SectionRule } from '../SectionRule';
import { SENSITIVE_LDL_THRESHOLD_DB } from './LdlResults';

interface Props {
  runs: LdlRun[];
}

function sensitiveCount(run: LdlRun): number {
  return run.results.filter((r) => r.ldlDb !== null && r.ldlDb <= SENSITIVE_LDL_THRESHOLD_DB)
    .length;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Trend across the most recent runs, oldest to newest. */
function trendLabel(counts: number[]): string {
  if (counts.length < 2) return '';
  const first = counts[0];
  const last = counts[counts.length - 1];
  if (last < first) return '↓ improving';
  if (last > first) return '↑ more sensitive frequencies';
  return '→ steady';
}

export function LdlHistory({ runs }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (runs.length === 0) return null;

  // Stored newest-first; render oldest-first so the trend line reads left-to-right in time.
  const chronological = [...runs].reverse();
  const counts = chronological.map(sensitiveCount);
  const trend = trendLabel(counts);
  const recent = [...runs].slice(0, 5);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Past results" hint={`${runs.length} run${runs.length === 1 ? '' : 's'}`} />

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
            {sensitiveCount(run)} sensitive {sensitiveCount(run) === 1 ? 'sound' : 'sounds'}
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
