import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LDL_TEST_FREQUENCIES_HZ, MAX_TONE_LEVEL_DB } from '../../constants/safety';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  connected: boolean;
  onStart: () => void;
}

export function LdlIntro({ connected, onStart }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.textPrimary }]}>
        Loudness Discomfort Test
      </Text>

      <Text style={[styles.body, { color: c.textSecondary }]}>
        This test finds the frequencies that are uncomfortable for you. You will
        hear {LDL_TEST_FREQUENCIES_HZ.length} tones, one at a time. Each tone
        starts very quiet and gets louder in small, slow steps.
      </Text>

      <Text style={[styles.body, { color: c.textSecondary }]}>
        The moment a tone becomes uncomfortable — not painful, just clearly
        unpleasant — press the big STOP button. The tone cuts off instantly.
      </Text>

      <View style={[styles.safetyBox, { borderColor: c.statusScanning }]}>
        <Text style={[styles.safetyTitle, { color: c.statusScanning }]}>
          SAFETY LIMITS ACTIVE
        </Text>
        <Text style={[styles.safetyText, { color: c.textSecondary }]}>
          Output is hard-capped at {MAX_TONE_LEVEL_DB} dB. A tone that reaches
          the cap, or plays too long, stops itself automatically. You can stop
          the whole test at any time.
        </Text>
      </View>

      {!connected && (
        <Text style={[styles.warn, { color: c.statusDisconnected }]}>
          Connect to your AcousticShield device to begin.
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.startBtn,
          { backgroundColor: connected ? c.btnConnectBg : c.sliderDisabled },
        ]}
        disabled={!connected}
        onPress={onStart}
        activeOpacity={0.8}
      >
        <Text style={[styles.startBtnText, { color: c.btnConnectText }]}>
          BEGIN TEST
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  safetyBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  safetyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  warn: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  startBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
