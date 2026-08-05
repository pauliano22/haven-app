import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MONO_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  label: string;
  /** Dim annotation at the right end of the rule. */
  hint?: string;
}

/**
 * Patch-bay rule label — the app's signature structural device. A mono
 * uppercase label engraved in a hairline rule, marking each card as a
 * labeled module in the rack:
 *
 *   ── TARGET FREQUENCY ────────────────── trigger
 */
export function SectionRule({ label, hint }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.row}>
      <View style={[styles.rule, styles.ruleLead, { backgroundColor: c.border }]} />
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <View style={[styles.rule, styles.ruleTail, { backgroundColor: c.border }]} />
      {hint != null && (
        <Text style={[styles.hint, { color: c.textSecondary }]}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  ruleLead: {
    width: 12,
    marginRight: 8,
  },
  ruleTail: {
    flex: 1,
    marginLeft: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    marginLeft: 8,
    opacity: 0.65,
  },
});
