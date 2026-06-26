import Slider from '@react-native-community/slider';
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ConnectionBar } from '../components/ConnectionBar';
import { useBle } from '../context/BleContext';
import { useDebouncedCallback } from '../hooks/useDebounce';

const F0_MIN = 200;
const F0_MAX = 8000;
const F0_DEFAULT = 4500;
const Q_MIN = 1.0;
const Q_MAX = 20.0;
const Q_DEFAULT = 10.0;

function formatFrequency(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

export function Dashboard() {
  const { status, sendPayload } = useBle();
  const isConnected = status === 'connected';

  const [f0, setF0] = useState(F0_DEFAULT);
  const [q, setQ] = useState(Q_DEFAULT);
  const [bypass, setBypass] = useState(false);

  // Debounced BLE writers — 100 ms per spec
  const debouncedSendFilter = useDebouncedCallback(
    (nextF0: number, nextQ: number) => {
      sendPayload({ type: 'FILTER_UPDATE', f0: Math.round(nextF0), Q: nextQ });
    },
    100,
  );

  const handleF0Change = useCallback(
    (value: number) => {
      setF0(value);
      if (isConnected && !bypass) debouncedSendFilter(value, q);
    },
    [isConnected, bypass, q, debouncedSendFilter],
  );

  const handleQChange = useCallback(
    (value: number) => {
      const rounded = Math.round(value * 10) / 10;
      setQ(rounded);
      if (isConnected && !bypass) debouncedSendFilter(f0, rounded);
    },
    [isConnected, bypass, f0, debouncedSendFilter],
  );

  const handleBypassToggle = useCallback(
    (value: boolean) => {
      setBypass(value);
      if (!isConnected) return;
      if (value) {
        sendPayload({ type: 'BYPASS', enabled: true });
      } else {
        sendPayload({ type: 'FILTER_UPDATE', f0: Math.round(f0), Q: q });
      }
    },
    [isConnected, f0, q, sendPayload],
  );

  const controlsDisabled = !isConnected || bypass;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>ACOUSTIC</Text>
          <Text style={styles.appTitleAccent}>SHIELD</Text>
          <Text style={styles.appSubtitle}>Medical DSP Remote Control</Text>
        </View>

        {/* ── Connection Status ───────────────────────── */}
        <ConnectionBar />

        {/* ── Frequency Sweeper ───────────────────────── */}
        <View style={[styles.card, controlsDisabled && !bypass && styles.cardDisabled]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TARGET FREQUENCY</Text>
            <Text style={styles.cardHint}>Pain trigger frequency</Text>
          </View>

          <Text style={styles.freqValue}>{formatFrequency(f0)}</Text>

          <Slider
            style={styles.mainSlider}
            minimumValue={F0_MIN}
            maximumValue={F0_MAX}
            value={f0}
            step={1}
            onValueChange={handleF0Change}
            minimumTrackTintColor={bypass ? '#1A2744' : '#00E5CC'}
            maximumTrackTintColor="#1A2744"
            thumbTintColor={bypass ? '#1A2744' : '#00E5CC'}
            disabled={bypass || !isConnected}
          />

          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>200 Hz</Text>
            <Text style={styles.rangeLabel}>8000 Hz</Text>
          </View>

          <View style={styles.freqBadgeRow}>
            {[500, 1000, 2000, 4000, 8000].map((hz) => (
              <Text key={hz} style={styles.freqBadge}>
                {hz >= 1000 ? `${hz / 1000}k` : hz}
              </Text>
            ))}
          </View>
        </View>

        {/* ── Q-Factor Slider ─────────────────────────── */}
        <View style={[styles.card, controlsDisabled && !bypass && styles.cardDisabled]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>NOTCH WIDTH</Text>
            <Text style={styles.cardHint}>Q-Factor</Text>
          </View>

          <View style={styles.qValueRow}>
            <Text style={styles.qValue}>Q = {q.toFixed(1)}</Text>
            <View style={styles.qDescBadge}>
              <Text style={styles.qDescText}>
                {q <= 5 ? 'Wide Band' : q <= 12 ? 'Moderate' : 'Surgical'}
              </Text>
            </View>
          </View>

          <Slider
            style={styles.secondarySlider}
            minimumValue={Q_MIN}
            maximumValue={Q_MAX}
            value={q}
            step={0.1}
            onValueChange={handleQChange}
            minimumTrackTintColor={bypass ? '#1A2744' : '#00E5CC'}
            maximumTrackTintColor="#1A2744"
            thumbTintColor={bypass ? '#1A2744' : '#00BFFF'}
            disabled={bypass || !isConnected}
          />

          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>1.0  Wide</Text>
            <Text style={styles.rangeLabel}>Pinpoint  20.0</Text>
          </View>
        </View>

        {/* ── Bypass Toggle ───────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.bypassRow}>
            <View>
              <Text style={styles.cardLabel}>BYPASS FILTER</Text>
              <Text style={styles.cardHint}>
                {bypass ? 'DSP inactive — raw audio pass-through' : 'Filter active'}
              </Text>
            </View>
            <View style={styles.bypassRight}>
              <Text style={[styles.bypassStatus, bypass ? styles.bypassOff : styles.bypassOn]}>
                {bypass ? 'BYPASSED' : 'ACTIVE'}
              </Text>
              <Switch
                value={bypass}
                onValueChange={handleBypassToggle}
                trackColor={{ false: '#00E5CC', true: '#FF4D6D' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#00E5CC"
                disabled={!isConnected}
              />
            </View>
          </View>
        </View>

        {/* ── Payload Preview ─────────────────────────── */}
        <View style={styles.payloadCard}>
          <Text style={styles.payloadLabel}>LAST PAYLOAD</Text>
          <Text style={styles.payloadText}>
            {bypass
              ? `{"type":"BYPASS","enabled":true}`
              : `{"type":"FILTER_UPDATE","f0":${Math.round(f0)},"Q":${q.toFixed(1)}}`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CYAN = '#00E5CC';
const BG = '#060B14';
const CARD_BG = '#0D1628';
const BORDER = '#1A2744';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#6B7FA3';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ── Header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: 8,
  },
  appTitleAccent: {
    fontSize: 32,
    fontWeight: '900',
    color: CYAN,
    letterSpacing: 8,
    marginTop: -6,
  },
  appSubtitle: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // ── Cards
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 16,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },
  cardHint: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    opacity: 0.6,
  },

  // ── Frequency
  freqValue: {
    fontSize: 52,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 8,
  },
  mainSlider: {
    width: '100%',
    height: 48,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
  },
  freqBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  freqBadge: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    opacity: 0.5,
    letterSpacing: 0.5,
  },

  // ── Q Factor
  qValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qValue: {
    fontSize: 36,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  qDescBadge: {
    backgroundColor: '#0A1E38',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qDescText: {
    fontSize: 12,
    color: CYAN,
    fontWeight: '600',
    letterSpacing: 1,
  },
  secondarySlider: {
    width: '100%',
    height: 40,
  },

  // ── Bypass
  bypassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bypassRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bypassStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  bypassOn: {
    color: CYAN,
  },
  bypassOff: {
    color: '#FF4D6D',
  },

  // ── Payload preview
  payloadCard: {
    backgroundColor: '#080E1C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10192E',
    padding: 16,
    marginTop: 4,
  },
  payloadLabel: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
    marginBottom: 8,
  },
  payloadText: {
    fontSize: 13,
    color: '#4EC9B0',
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
});
