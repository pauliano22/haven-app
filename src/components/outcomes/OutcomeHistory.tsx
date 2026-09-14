import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { ThiRun, VasCheckIn } from '../../types';
import { thiGrade, thiTrend } from '../../utils/thi';
import { SectionRule } from '../SectionRule';

interface Props {
  vas: VasCheckIn[];
  thi: ThiRun[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Trend on the bother rating, first vs latest, needs ≥ 2 points to say anything. */
function vasTrend(chronological: VasCheckIn[]): string {
  if (chronological.length < 2) return '';
  const first = chronological[0].bother;
  const last = chronological[chronological.length - 1].bother;
  if (last <= first - 2) return '↓ less bothersome than when you started';
  if (last >= first + 2) return '↑ more bothersome than when you started';
  return '→ about the same as when you started';
}

/** Same shape as LdlHistory / MatchHistory: quiet trend line, five most recent rows. */
export function OutcomeHistory({ vas, thi }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (vas.length === 0 && thi.length === 0) return null;

  const vasChrono = [...vas].reverse();
  const recentVas = vas.slice(0, 5);
  const recentThi = thi.slice(0, 5);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Over time" hint={`${vas.length} check-in${vas.length === 1 ? '' : 's'}`} />

      {vas.length > 0 && (
        <>
          {vasTrend(vasChrono) !== '' && (
            <Text style={[styles.trend, { color: c.textSecondary }]}>{vasTrend(vasChrono)}</Text>
          )}
          {recentVas.map((v, i) => (
            <View
              key={v.timestamp}
              style={[styles.row, i < recentVas.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.borderDeep }]}
            >
              <Text style={[styles.rowDate, { color: c.textPrimary }]}>{formatDate(v.timestamp)}</Text>
              <Text style={[styles.rowSummary, { color: c.textSecondary }]}>
                loud {v.loudness}/10 · bother {v.bother}/10
              </Text>
            </View>
          ))}
        </>
      )}

      {thi.length > 0 && (
        <>
          <Text style={[styles.subhead, { color: c.textSecondary }]}>Questionnaire</Text>
          {recentThi.map((t, i) => {
            const previous = thi[i + 1];
            const trend = previous ? thiTrend(previous.total, t.total) : null;
            return (
              <View
                key={t.timestamp}
                style={[styles.row, i < recentThi.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.borderDeep }]}
              >
                <Text style={[styles.rowDate, { color: c.textPrimary }]}>{formatDate(t.timestamp)}</Text>
                <Text style={[styles.rowSummary, { color: c.textSecondary }]}>
                  {t.total}/100 · {thiGrade(t.total)}
                  {trend === 'better' ? ' · ↓ better' : trend === 'worse' ? ' · ↑ worse' : trend === 'same' ? ' · → same' : ''}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  trend: { fontSize: 12, fontFamily: SANS_FONT, marginBottom: 10 },
  subhead: {
    fontSize: 11,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  rowDate: { fontSize: 14, fontFamily: SERIF_FONT },
  rowSummary: { fontSize: 12, fontFamily: SANS_FONT },
});
