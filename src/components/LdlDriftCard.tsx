import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { LdlDriftWarning } from '../utils/ldlDrift';
import { SectionRule } from './SectionRule';

interface Props {
  warning: LdlDriftWarning;
  onPause: () => void;
  onDismiss: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz` : `${hz} Hz`;
}

/**
 * Surfaces an LDL drift warning (utils/ldlDrift.ts): the user's comfort
 * level at a frequency they are softening has dropped since their first
 * comfort test. Offers to pause that band; never does it on its own — the
 * same rule as the tolerance plan (constants/tolerance.ts).
 */
export function LdlDriftCard({ warning, onPause, onDismiss }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.statusDisconnected }]}>
      <SectionRule label="Worth a look" hint={formatFreq(warning.testFreqHz)} />
      <Text style={[styles.question, { color: c.textPrimary }]}>
        Your comfort level around {formatFreq(warning.testFreqHz)} has dropped since you
        started.
      </Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        It went from {Math.round(warning.baselineLdlDb)} dB to {Math.round(warning.latestLdlDb)} dB
        in your comfort tests, and you're softening {formatFreq(warning.f0)}. Keeping a sound
        quiet for a long time can make the ear more sensitive to it, not less. Consider pausing
        softening there for a while and re-testing.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: c.btnConnectBg }]}
          onPress={onPause}
          accessibilityRole="button"
          accessibilityLabel="Pause softening for this band"
        >
          <Text style={[styles.primaryText, { color: c.btnConnectText }]}>Pause this band</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Keep softening as it is"
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>Keep it</Text>
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
    lineHeight: 24,
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
});
