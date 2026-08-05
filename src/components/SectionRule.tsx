import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SANS_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  label: string;
  /** Dim annotation at the right edge. */
  hint?: string;
}

/**
 * Soft section caption — quiet label left, context right. Kept under its
 * historical name so every card header restyles in one place; the
 * terminal-era hairline rules are gone.
 */
export function SectionRule({ label, hint }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      {hint != null && (
        <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  hint: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    opacity: 0.65,
  },
});
