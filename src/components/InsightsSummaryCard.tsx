import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorPalette, RADIUS, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { SummarySource } from '../services/llmSummary';

interface Props {
  summaryText: string;
  /** 'llm' shows a small attribution line; 'fallback' shows none -- the
   * plain version stands on its own without needing to explain itself. */
  summarySource: SummarySource | null;
}

/**
 * Shows the trend summary from useHearingInsights() -- rendered only when
 * the caller has already checked hasRealData(insights) is true, so this
 * component never has to render an awkward "not enough data yet" state
 * itself. See docs/llm-summary.md for what "summaryText" actually is and
 * isn't (never an AI-added number that isn't in the real source data).
 */
export function InsightsSummaryCard({ summaryText, summarySource }: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme.colors);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your trends</Text>
      <Text style={styles.body}>{summaryText}</Text>
      {summarySource === 'llm' && <Text style={styles.attribution}>Rewritten for readability from your real test results.</Text>}
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 14,
    },
    title: {
      fontFamily: SERIF_FONT,
      fontSize: 19,
      color: c.textPrimary,
      marginBottom: 8,
    },
    body: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      lineHeight: 19,
      color: c.textSecondary,
    },
    attribution: {
      fontFamily: SANS_FONT,
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 10,
      fontStyle: 'italic',
    },
  });
}
