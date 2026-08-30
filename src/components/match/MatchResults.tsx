import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  f0: number;
  loudnessDb: number | null;
  onApply: () => void;
  onRedo: () => void;
  onClose: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz} Hz`;
}

export function MatchResults({ f0, loudnessDb, onApply, onRedo, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Your match" hint="done" />
      <Text style={[styles.freq, { color: c.accent }]}>{formatFreq(f0)}</Text>
      {loudnessDb != null && (
        <Text style={[styles.loudness, { color: c.textSecondary }]}>
          about as loud as {Math.round(loudnessDb)} dB
        </Text>
      )}

      <Text style={[styles.body, { color: c.textSecondary }]}>
        This is our best estimate of the pitch closest to what you hear.
        Softening it won't make the sound disappear, but many people find it
        easier to tune out once it's quieter than everything around it.
      </Text>

      <TouchableOpacity
        style={[styles.applyBtn, { backgroundColor: c.btnConnectBg }]}
        onPress={onApply}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Soften this sound"
      >
        <Text style={[styles.applyText, { color: c.btnConnectText }]}>
          Soften this sound
        </Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onRedo}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            Redo test
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onClose}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            Close
          </Text>
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
  },
  freq: {
    fontSize: 40,
    fontFamily: SERIF_FONT,
    textAlign: 'center',
    marginTop: 4,
  },
  loudness: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  body: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  applyBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyText: {
    fontSize: 14,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
