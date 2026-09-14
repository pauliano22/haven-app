import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { SectionRule } from './SectionRule';

interface Props {
  onAccept: () => void;
  onDecline?: () => void;
}

/**
 * Shown once before any logging begins (docs/safety.md, "Your data"). Plain
 * language, no legalese: what is recorded, where it lives, how it leaves,
 * how to delete it. Declining simply leaves the check-in tools unavailable.
 */
export function ConsentCard({ onAccept, onDecline }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Before we start" hint="your data" />
      <Text style={[styles.title, { color: c.textPrimary }]}>
        Keep a record on this phone?
      </Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        To see whether Haven is actually helping you, the app needs to remember a
        few things over time: when your device was connected, which sounds were
        being softened and by how much, whether protection was paused, and the
        ratings and questionnaires you fill in.
      </Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        • It stays on this phone. Nothing is uploaded anywhere.{'\n'}
        • It only leaves if you tap “Share my data” — then it goes wherever you send it.{'\n'}
        • You can turn it off at any time, and turning it off deletes the record.{'\n'}
        • It holds no name, email, or account; there is no account.
      </Text>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: c.btnConnectBg }]}
        onPress={onAccept}
        accessibilityRole="button"
        accessibilityLabel="Agree to keep a local record"
      >
        <Text style={[styles.primaryText, { color: c.btnConnectText }]}>Keep a record</Text>
      </TouchableOpacity>
      {onDecline && (
        <TouchableOpacity onPress={onDecline} accessibilityRole="button" accessibilityLabel="Not now">
          <Text style={[styles.declineLink, { color: c.textSecondary }]}>Not now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  title: { fontSize: 20, fontFamily: SERIF_FONT, lineHeight: 27, marginBottom: 10 },
  body: { fontSize: 13, fontFamily: SANS_FONT, lineHeight: 20, marginBottom: 12 },
  primaryBtn: { borderRadius: RADIUS_SM, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 14, fontFamily: SANS_FONT, fontWeight: '700' },
  declineLink: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});
