import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FilterBand, WireFilterBand } from '../types';

const F0_MIN = 200;
const F0_MAX = 8000;
const F0_DEFAULT = 4500;
const Q_MIN = 1.0;
const Q_MAX = 20.0;
const Q_DEFAULT = 10.0;
// Matches MAX_BANDS in the firmware — payloads with more bands are truncated on-device.
const MAX_BANDS = 5;

function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(2)} kHz`;
  }
  return `${String(Math.round(hz)).padStart(4, ' ')} Hz`;
}

function formatChip(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

function haptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(style).catch(() => {});
  }
}

let _nextId = 1;
function makeId(): string {
  return String(_nextId++);
}

// Strip UI-only fields and use the uppercase Q key the firmware expects.
function toWireBands(bands: FilterBand[]): WireFilterBand[] {
  return bands.map(b => ({ f0: b.f0, Q: +b.q.toFixed(1) }));
}

export function Dashboard() {
  const { status, queuedCount, sendPayload } = useBle();
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  // Controls stay usable while disconnected — payloads queue in the
  // BleConnectionManager and flush automatically on reconnect.
  const isConnected = status === 'connected';

  const [bands, setBands] = useState<FilterBand[]>(() => {
    const id = makeId();
    return [{ id, f0: F0_DEFAULT, q: Q_DEFAULT }];
  });
  const [selectedId, setSelectedId] = useState<string>(bands[0].id);
  const [bypass, setBypass] = useState(false);

  const selectedBand = bands.find(b => b.id === selectedId) ?? bands[0];
  const lastBucketRef = useRef(Math.floor(F0_DEFAULT / 100));

  useEffect(() => {
    lastBucketRef.current = Math.floor(selectedBand.f0 / 100);
  }, [selectedId]); // intentionally omit selectedBand.f0 — only reset on band switch

  const debouncedSendFilter = useDebouncedCallback(
    (nextBands: FilterBand[]) => {
      sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(nextBands) });
    },
    100,
  );

  const addBand = useCallback(() => {
    if (bands.length >= MAX_BANDS) return;
    const id = makeId();
    const newBand: FilterBand = { id, f0: F0_DEFAULT, q: Q_DEFAULT };
    setBands(prev => [...prev, newBand]);
    setSelectedId(id);
  }, [bands.length]);

  const removeBand = useCallback(
    (id: string) => {
      if (bands.length <= 1) return;
      const next = bands.filter(b => b.id !== id);
      setBands(next);
      if (selectedId === id) setSelectedId(next[0].id);
    },
    [bands, selectedId],
  );

  const handleF0Change = useCallback(
    (value: number) => {
      const nextBands = bands.map(b =>
        b.id === selectedId ? { ...b, f0: Math.round(value) } : b,
      );
      setBands(nextBands);

      const bucket = Math.floor(value / 100);
      if (bucket !== lastBucketRef.current) {
        lastBucketRef.current = bucket;
        haptic(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!bypass) debouncedSendFilter(nextBands);
    },
    [bands, selectedId, bypass, debouncedSendFilter],
  );

  const handleQChange = useCallback(
    (value: number) => {
      const rounded = Math.round(value * 10) / 10;
      const nextBands = bands.map(b =>
        b.id === selectedId ? { ...b, q: rounded } : b,
      );
      setBands(nextBands);
      if (!bypass) debouncedSendFilter(nextBands);
    },
    [bands, selectedId, bypass, debouncedSendFilter],
  );

  const handleBypassToggle = useCallback(
    (value: boolean) => {
      setBypass(value);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      if (value) {
        sendPayload({ type: 'BYPASS', enabled: true });
      } else {
        sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(bands) });
      }
    },
    [bands, sendPayload],
  );

  const sliderTrack = bypass ? c.sliderDisabled : c.accent;
  const sliderThumbQ = bypass ? c.sliderDisabled : c.accentSecondary;

  const payloadPreview = bypass
    ? `{"type":"BYPASS","enabled":true}`
    : `{"type":"MULTI_FILTER","bands":${JSON.stringify(toWireBands(bands))}}`;

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
        <VisualizerCurve bands={bands} selectedId={selectedId} bypass={bypass} />

        {/* ── Frequency Sweeper ───────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TARGET FREQUENCY</Text>
            <Text style={styles.cardHint}>Pain trigger frequency</Text>
          </View>

          {/* ── Band selector ─────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bandRow}
            contentContainerStyle={styles.bandRowContent}
          >
            {bands.map(band => (
              <View
                key={band.id}
                style={[styles.bandChip, band.id === selectedId && styles.bandChipActive]}
              >
                <TouchableOpacity
                  onPress={() => setSelectedId(band.id)}
                  style={styles.bandChipLabel}
                >
                  <Text
                    style={[
                      styles.bandChipText,
                      band.id === selectedId && styles.bandChipTextActive,
                    ]}
                  >
                    {formatChip(band.f0)}
                  </Text>
                </TouchableOpacity>
                {bands.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeBand(band.id)}
                    style={styles.bandChipRemove}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={styles.bandChipRemoveText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {bands.length < MAX_BANDS && (
              <TouchableOpacity
                style={styles.bandAddBtn}
                onPress={addBand}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.bandAddText}>＋</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <Text style={styles.freqValue}>{formatFrequency(selectedBand.f0)}</Text>

          <Slider
            style={styles.mainSlider}
            minimumValue={F0_MIN}
            maximumValue={F0_MAX}
            value={selectedBand.f0}
            step={1}
            onValueChange={handleF0Change}
            minimumTrackTintColor={sliderTrack}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={sliderTrack}
            disabled={bypass}
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
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>NOTCH WIDTH</Text>
            <Text style={styles.cardHint}>Q-Factor</Text>
          </View>

          <View style={styles.qValueRow}>
            <Text style={styles.qValue}>Q = {selectedBand.q.toFixed(1)}</Text>
            <View style={styles.qDescBadge}>
              <Text style={styles.qDescText}>
                {selectedBand.q <= 5 ? 'Wide Band' : selectedBand.q <= 12 ? 'Moderate' : 'Surgical'}
              </Text>
            </View>
          </View>

          <Slider
            style={styles.secondarySlider}
            minimumValue={Q_MIN}
            maximumValue={Q_MAX}
            value={selectedBand.q}
            step={0.1}
            onValueChange={handleQChange}
            minimumTrackTintColor={sliderTrack}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={sliderThumbQ}
            disabled={bypass}
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
              />
            </View>
          </View>
        </View>

        {/* ── Payload Preview ─────────────────────────── */}
        <View style={styles.payloadCard}>
          <Text style={styles.payloadLabel}>
            {queuedCount > 0 && !isConnected ? 'LAST PAYLOAD — QUEUED' : 'LAST PAYLOAD'}
          </Text>
          <Text style={styles.payloadText}>{payloadPreview}</Text>
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

    // ── Band selector
    bandRow: {
      marginBottom: 14,
    },
    bandRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bandChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: 'transparent',
    },
    bandChipActive: {
      borderColor: c.accent,
      backgroundColor: c.qBadgeBg,
    },
    bandChipLabel: {
      paddingVertical: 6,
      paddingLeft: 10,
      paddingRight: 6,
    },
    bandChipText: {
      fontSize: 12,
      fontFamily: MONO_FONT,
      fontWeight: '600',
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    bandChipTextActive: {
      color: c.accent,
    },
    bandChipRemove: {
      paddingVertical: 6,
      paddingRight: 8,
      paddingLeft: 2,
    },
    bandChipRemoveText: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 16,
    },
    bandAddBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bandAddText: {
      fontSize: 16,
      color: c.textSecondary,
      lineHeight: 18,
    },

    // ── Frequency
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
