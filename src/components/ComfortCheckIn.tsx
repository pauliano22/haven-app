import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { SectionRule } from './SectionRule';

export type ComfortDirection = 'weaker' | 'same' | 'stronger';

interface Props {
  onRespond: (direction: ComfortDirection) => void;
}

export function ComfortCheckIn({ onRespond }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Quick check-in" hint="optional" />
      <Text style={[styles.question, { color: c.textPrimary }]}>How does this sound?</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.option, { borderColor: c.border }]}
          onPress={() => onRespond('weaker')}
          accessibilityRole="button"
          accessibilityLabel="Too strong, soften it less"
        >
          <Text style={[styles.optionText, { color: c.textSecondary }]}>Too strong</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, styles.optionPrimary, { backgroundColor: c.btnConnectBg }]}
          onPress={() => onRespond('same')}
          accessibilityRole="button"
          accessibilityLabel="Just right, keep it as is"
        >
          <Text style={[styles.optionText, { color: c.btnConnectText, fontWeight: '700' }]}>
            Just right
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, { borderColor: c.border }]}
          onPress={() => onRespond('stronger')}
          accessibilityRole="button"
          accessibilityLabel="Not enough, soften it more"
        >
          <Text style={[styles.optionText, { color: c.textSecondary }]}>Not enough</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionPrimary: {
    borderWidth: 0,
  },
  optionText: {
    fontSize: 12.5,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
});
