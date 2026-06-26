import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ColorPalette, MONO_FONT } from '../constants/theme';
import { ConnectionBar } from '../components/ConnectionBar';
import { VisualizerCurve } from '../components/VisualizerCurve';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { useDebouncedCallback } from '../hooks/useDebounce';

const F0_MIN = 200;
const F0_MAX = 8000;
const F0_DEFAULT = 4500;
const Q_MIN = 1.0;
const Q_MAX = 20.0;
const Q_DEFAULT = 10.0;

function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    // Always render as X.XX kHz so the string length is constant → no layout jitter
    return `${(hz / 1000).toFixed(2)} kHz`;
  }
  return `${String(Math.round(hz)).padStart(4, ' ')} Hz`; // figure-space pad
}

// Haptics silently no-op on web / simulator
function haptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(style).catch(() => {});
  }
}

export function Dashboard() {
  const { status, sendPayload } = useBle();
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const isConnected = status === 'connected';
  const [f0, setF0] = useState(F0_DEFAULT);
  const [q, setQ] = useState(Q_DEFAULT);
  const [bypass, setBypass] = useState(false);

  // Track last 100 Hz bucket to fire a haptic tick on each boundary crossing
  const lastBucketRef = useRef(Math.floor(F0_DEFAULT / 100));

  const debouncedSendFilter = useDebouncedCallback(
    (nextF0: number, nextQ: number) => {
      sendPayload({ type: 'FILTER_UPDATE', f0: Math.round(nextF0), Q: nextQ });
    },
    100,
  );

  const handleF0Change = useCallback(
    (value: number) => {
      setF0(value);

      // Fire a light haptic tick every 100 Hz boundary
      const bucket = Math.floor(value / 100);
      if (bucket !== lastBucketRef.current) {
        lastBucketRef.current = bucket;
        haptic(Haptics.ImpactFeedbackStyle.Light);
      }

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
      haptic(Haptics.ImpactFeedbackStyle.Medium);
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
  const sliderTrack = bypass ? c.sliderDisabled : c.accent;
  const sliderThumbQ = bypass ? c.sliderDisabled : c.accentSecondary;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.headerWrap}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.appTitle}>ACOUSTIC</Text>
            <Text style={styles.appTitleAccent}>SHIELD</Text>
            <Text style={styles.appSubtitle}>Medical DSP Remote Control</Text>
          </View>
          <TouchableOpacity
            style={styles.themeToggle}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Text style={styles.themeToggleIcon}>{theme.dark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Connection Status ───────────────────────── */}
        <ConnectionBar />

        {/* ── EQ Visualizer ───────────────────────────── */}
        <VisualizerCurve f0={f0} q={q} bypass={bypass} />

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
            minimumTrackTintColor={sliderTrack}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={sliderTrack}
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
            minimumTrackTintColor={sliderTrack}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={sliderThumbQ}
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
              <Text style={[styles.bypassStatus, { color: bypass ? c.bypassOff : c.bypassOn }]}>
                {bypass ? 'BYPASSED' : 'ACTIVE'}
              </Text>
              <Switch
                value={bypass}
                onValueChange={handleBypassToggle}
                trackColor={{ false: c.bypassOn, true: c.bypassOff }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={c.bypassOn}
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

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },

    // ── Header
    headerWrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: 28,
      position: 'relative',
    },
    headerTitleBlock: {
      alignItems: 'center',
    },
    appTitle: {
      fontSize: 32,
      fontWeight: '900',
      color: c.textPrimary,
      letterSpacing: 8,
    },
    appTitleAccent: {
      fontSize: 32,
      fontWeight: '900',
      color: c.accent,
      letterSpacing: 8,
      marginTop: -6,
    },
    appSubtitle: {
      fontSize: 11,
      color: c.textSecondary,
      letterSpacing: 3,
      marginTop: 6,
      textTransform: 'uppercase',
    },
    themeToggle: {
      position: 'absolute',
      right: 0,
      top: 4,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.toggleBg,
      borderWidth: 1,
      borderColor: c.toggleBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleIcon: {
      fontSize: 18,
    },

    // ── Cards
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
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
      color: c.textSecondary,
      letterSpacing: 2,
    },
    cardHint: {
      fontSize: 11,
      color: c.textSecondary,
      opacity: 0.6,
    },

    // ── Frequency — monospaced so digits don't shift the layout
    freqValue: {
      fontSize: 52,
      fontWeight: '800',
      fontFamily: MONO_FONT,
      color: c.textPrimary,
      letterSpacing: 0,
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
      color: c.textSecondary,
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
      color: c.textSecondary,
      opacity: 0.5,
      letterSpacing: 0.5,
    },

    // ── Q Factor — monospaced so Q = X.X doesn't shift
    qValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    qValue: {
      fontSize: 36,
      fontWeight: '700',
      fontFamily: MONO_FONT,
      color: c.textPrimary,
      letterSpacing: 0,
    },
    qDescBadge: {
      backgroundColor: c.qBadgeBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    qDescText: {
      fontSize: 12,
      color: c.accent,
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

    // ── Payload preview
    payloadCard: {
      backgroundColor: c.cardBgDeep,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderDeep,
      padding: 16,
      marginTop: 4,
    },
    payloadLabel: {
      fontSize: 9,
      color: c.textSecondary,
      letterSpacing: 2,
      marginBottom: 8,
    },
    payloadText: {
      fontSize: 13,
      fontFamily: MONO_FONT,
      color: c.payloadText,
      letterSpacing: 0.3,
    },
  });
}
