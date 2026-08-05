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
import { ColorPalette, MONO_FONT, RADIUS, RADIUS_SM } from '../constants/theme';
import { Blink } from '../components/Blink';
import { ConnectionBar } from '../components/ConnectionBar';
import { SectionRule } from '../components/SectionRule';
import { VisualizerCurve } from '../components/VisualizerCurve';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { FilterBand, WireFilterBand } from '../types';

import {
  ATTEN_DEFAULT_DB,
  ATTEN_MAX_DB,
  ATTEN_MIN_DB,
  F0_DEFAULT,
  F0_MAX,
  F0_MIN,
  MAX_BANDS,
  Q_DEFAULT,
  Q_MAX,
  Q_MIN,
} from '../constants/dsp';

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
  return bands.map(b => ({
    f0: b.f0,
    Q: +b.q.toFixed(1),
    atten_db: Math.round(b.attenDb),
  }));
}

function attenLabel(attenDb: number): string {
  if (attenDb >= ATTEN_MAX_DB) return 'Max (Notch)';
  if (attenDb >= 25) return 'Strong';
  if (attenDb >= 12) return 'Moderate';
  return 'Gentle';
}

interface DashboardProps {
  onOpenLdl: () => void;
  /** Bands handed over from the LDL test results screen. */
  importedBands: FilterBand[] | null;
  onImportConsumed: () => void;
}

export function Dashboard({ onOpenLdl, importedBands, onImportConsumed }: DashboardProps) {
  const { status, queuedCount, sendPayload } = useBle();
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  // Controls stay usable while disconnected — payloads queue in the
  // BleConnectionManager and flush automatically on reconnect.
  const isConnected = status === 'connected';

  const [bands, setBands] = useState<FilterBand[]>(() => {
    const id = makeId();
    return [{ id, f0: F0_DEFAULT, q: Q_DEFAULT, attenDb: ATTEN_DEFAULT_DB }];
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

  // Adopt bands produced by the LDL test: replace the current set and push
  // them to the device immediately.
  useEffect(() => {
    if (!importedBands || importedBands.length === 0) return;
    setBands(importedBands);
    setSelectedId(importedBands[0].id);
    setBypass(false);
    sendPayload({ type: 'MULTI_FILTER', bands: toWireBands(importedBands) });
    onImportConsumed();
  }, [importedBands, onImportConsumed, sendPayload]);

  const addBand = useCallback(() => {
    if (bands.length >= MAX_BANDS) return;
    const id = makeId();
    const newBand: FilterBand = { id, f0: F0_DEFAULT, q: Q_DEFAULT, attenDb: ATTEN_DEFAULT_DB };
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

  const handleAttenChange = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      const nextBands = bands.map(b =>
        b.id === selectedId ? { ...b, attenDb: rounded } : b,
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
          <View>
            <View style={styles.wordmarkRow}>
              <Text style={styles.appTitle}>HAVEN</Text>
              <Blink style={styles.cursor}>▍</Blink>
            </View>
            <Text style={styles.appSubtitle}>{'// remote console · adau1860 dsp'}</Text>
          </View>
          <TouchableOpacity
            style={styles.themeToggle}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Toggle light or dark theme"
          >
            <Text style={styles.themeToggleIcon}>{theme.dark ? '◖' : '◗'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Connection Status ───────────────────────── */}
        <ConnectionBar />

        {/* ── EQ Visualizer ───────────────────────────── */}
        <VisualizerCurve bands={bands} selectedId={selectedId} bypass={bypass} />

        {/* ── Frequency Sweeper ───────────────────────── */}
        <View style={styles.card}>
          <SectionRule label="Target frequency" hint="pain trigger" />

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
          <SectionRule label="Band width" hint="q-factor" />

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

        {/* ── Dampening Depth Slider ──────────────────── */}
        <View style={styles.card}>
          <SectionRule label="Dampening" hint="cut depth" />

          <View style={styles.qValueRow}>
            <Text style={styles.qValue}>
              −{Math.round(selectedBand.attenDb)} dB
            </Text>
            <View style={styles.qDescBadge}>
              <Text style={styles.qDescText}>{attenLabel(selectedBand.attenDb)}</Text>
            </View>
          </View>

          <Slider
            style={styles.secondarySlider}
            minimumValue={ATTEN_MIN_DB}
            maximumValue={ATTEN_MAX_DB}
            value={selectedBand.attenDb}
            step={1}
            onValueChange={handleAttenChange}
            minimumTrackTintColor={sliderTrack}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={sliderThumbQ}
            disabled={bypass}
          />

          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>−{ATTEN_MIN_DB} dB  Subtle</Text>
            <Text style={styles.rangeLabel}>Full Notch  −{ATTEN_MAX_DB} dB</Text>
          </View>
        </View>

        {/* ── Bypass Toggle ───────────────────────────── */}
        <View style={styles.card}>
          <SectionRule
            label="Bypass"
            hint={bypass ? 'signal cut' : 'signal flowing'}
          />
          <View style={styles.bypassRow}>
            <View>
              <Text style={styles.cardBody}>
                {bypass ? 'Raw audio pass-through' : 'Filter engaged'}
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

        {/* ── LDL Test Entry ──────────────────────────── */}
        <View style={styles.card}>
          <SectionRule label="Hearing profile" hint="guided" />
          <View style={styles.bypassRow}>
            <View style={styles.ldlTextBlock}>
              <Text style={styles.cardBody}>
                Find your uncomfortable frequencies
              </Text>
            </View>
            <TouchableOpacity
              style={styles.ldlBtn}
              onPress={onOpenLdl}
              activeOpacity={0.8}
            >
              <Text style={styles.ldlBtnText}>LDL TEST ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TX Monitor ──────────────────────────────── */}
        <View style={styles.payloadCard}>
          <SectionRule
            label="TX monitor"
            hint={queuedCount > 0 && !isConnected ? `${queuedCount} queued` : 'last frame'}
          />
          <Text style={styles.payloadText}>
            <Text style={styles.payloadPrompt}>{'> '}</Text>
            {payloadPreview}
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
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    wordmarkRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    appTitle: {
      fontSize: 24,
      fontWeight: '700',
      fontFamily: MONO_FONT,
      color: c.textPrimary,
      letterSpacing: 1,
    },
    cursor: {
      fontSize: 24,
      fontFamily: MONO_FONT,
      color: c.accent,
      marginLeft: 2,
    },
    appSubtitle: {
      fontSize: 11,
      fontFamily: MONO_FONT,
      color: c.textSecondary,
      letterSpacing: 0.5,
      marginTop: 4,
    },
    themeToggle: {
      width: 44,
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: c.toggleBg,
      borderWidth: 1,
      borderColor: c.toggleBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleIcon: {
      fontSize: 16,
      color: c.textSecondary,
    },

    // ── Cards
    card: {
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 14,
    },
    cardBody: {
      fontSize: 13,
      color: c.textPrimary,
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
      borderRadius: RADIUS_SM,
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
      borderRadius: RADIUS_SM,
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
      fontSize: 48,
      fontWeight: '700',
      fontFamily: MONO_FONT,
      color: c.accent,
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
      fontSize: 10,
      fontFamily: MONO_FONT,
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
      fontFamily: MONO_FONT,
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
      fontSize: 34,
      fontWeight: '700',
      fontFamily: MONO_FONT,
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    qDescBadge: {
      backgroundColor: c.qBadgeBg,
      borderRadius: RADIUS_SM,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    qDescText: {
      fontSize: 11,
      fontFamily: MONO_FONT,
      color: c.accent,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'lowercase',
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
      fontFamily: MONO_FONT,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    // ── LDL entry
    ldlTextBlock: {
      flex: 1,
      paddingRight: 12,
    },
    ldlBtn: {
      backgroundColor: c.btnConnectBg,
      borderRadius: RADIUS_SM,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    ldlBtnText: {
      color: c.btnConnectText,
      fontSize: 12,
      fontFamily: MONO_FONT,
      fontWeight: '700',
      letterSpacing: 1.5,
    },

    // ── TX monitor
    payloadCard: {
      backgroundColor: c.cardBgDeep,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.borderDeep,
      padding: 16,
      marginTop: 4,
    },
    payloadText: {
      fontSize: 12,
      fontFamily: MONO_FONT,
      color: c.payloadText,
      letterSpacing: 0.3,
      lineHeight: 18,
    },
    payloadPrompt: {
      color: c.textSecondary,
    },
  });
}
