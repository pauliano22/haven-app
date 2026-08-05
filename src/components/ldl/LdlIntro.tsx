import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LDL_TEST_FREQUENCIES_HZ, MAX_TONE_LEVEL_DB } from '../../constants/safety';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  connected: boolean;
  onStart: () => void;
}

export function LdlIntro({ connected, onStart }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Loudness discomfort" hint="guided test" />
      <Text style={[styles.title, { color: c.textPrimary }]}>
        Find what hurts.{'\n'}Then quiet it.
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
          Safety limits active
        </Text>
        <Text style={[styles.safetyText, { color: c.textSecondary }]}>
          Output is hard-capped at {MAX_TONE_LEVEL_DB} dB. A tone that reaches
          the cap, or plays too long, stops itself automatically. You can stop
          the whole test at any time.
        </Text>
      </View>

      {!connected && (
        <Text style={[styles.warn, { color: c.statusDisconnected }]}>
          Connect to your Haven device to begin.
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
          Begin test
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
  },
  title: {
    fontSize: 26,
    fontFamily: SERIF_FONT,
    letterSpacing: 0,
    lineHeight: 33,
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    fontFamily: SANS_FONT,
    lineHeight: 22,
    marginBottom: 12,
  },
  safetyBox: {
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  safetyText: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    lineHeight: 18,
  },
  warn: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  startBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 15,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
