import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConnectionBar } from '../components/ConnectionBar';
import { SectionRule } from '../components/SectionRule';
import { VisualizerCurve } from '../components/VisualizerCurve';
import {
  ATTEN_MAX_DB,
  ATTEN_MIN_DB,
  F0_MAX,
  F0_MIN,
  MAX_BANDS,
  Q_MAX,
  Q_MIN,
} from '../constants/dsp';
import { ColorPalette, RADIUS, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';

function formatFrequency(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${Math.round(hz)} Hz`;
}

function formatChip(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

function attenLabel(attenDb: number): string {
  if (attenDb >= ATTEN_MAX_DB) return 'Fully softened';
  if (attenDb >= 25) return 'Strongly softened';
  if (attenDb >= 12) return 'Moderately softened';
  return 'Gently softened';
}

function haptic(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
}

export function Tune() {
  const { bands, selectedId, selectedBand, bypass, selectBand, addBand, removeBand, updateSelected } =
    useFilters();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const lastBucketRef = useRef(Math.floor(selectedBand.f0 / 100));
  useEffect(() => {
    lastBucketRef.current = Math.floor(selectedBand.f0 / 100);
  }, [selectedId]); // intentionally omit selectedBand.f0 — only reset on band switch

  const handleF0Change = useCallback(
    (value: number) => {
      updateSelected({ f0: Math.round(value) });
      const bucket = Math.floor(value / 100);
      if (bucket !== lastBucketRef.current) {
        lastBucketRef.current = bucket;
        haptic(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [updateSelected],
  );

  const handleQChange = useCallback(
    (value: number) => updateSelected({ q: Math.round(value * 10) / 10 }),
    [updateSelected],
  );

  const handleAttenChange = useCallback(
    (value: number) => updateSelected({ attenDb: Math.round(value) }),
    [updateSelected],
  );

  const trackColor = bypass ? c.sliderDisabled : c.accent;
  const thumbColorSecondary = bypass ? c.sliderDisabled : c.accentSecondary;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Tune your sound</Text>
        <Text style={styles.subtitle}>
          {bypass ? 'Protection is paused — resume it from Home to hear changes.' : 'Adjust which sounds are softened, and by how much.'}
        </Text>

        <ConnectionBar />

        <VisualizerCurve bands={bands} selectedId={selectedId} bypass={bypass} />

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
              <TouchableOpacity onPress={() => selectBand(band.id)} style={styles.bandChipLabel}>
                <Text
                  style={[styles.bandChipText, band.id === selectedId && styles.bandChipTextActive]}
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

        {/* ── Frequency ────────────────────────────────  */}
        <View style={styles.card}>
          <SectionRule label="Frequency" hint="what to soften" />
          <Text style={styles.freqValue}>{formatFrequency(selectedBand.f0)}</Text>
          <Slider
            style={styles.mainSlider}
            minimumValue={F0_MIN}
            maximumValue={F0_MAX}
            value={selectedBand.f0}
            step={1}
            onValueChange={handleF0Change}
            minimumTrackTintColor={trackColor}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={trackColor}
            disabled={bypass}
          />
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>200 Hz</Text>
            <Text style={styles.rangeLabel}>8 kHz</Text>
          </View>
        </View>

        {/* ── Dampening ────────────────────────────────  */}
        <View style={styles.card}>
          <SectionRule label="Softening" hint={attenLabel(selectedBand.attenDb)} />
          <Text style={styles.freqValue}>−{Math.round(selectedBand.attenDb)} dB</Text>
          <Slider
            style={styles.mainSlider}
            minimumValue={ATTEN_MIN_DB}
            maximumValue={ATTEN_MAX_DB}
            value={selectedBand.attenDb}
            step={1}
            onValueChange={handleAttenChange}
            minimumTrackTintColor={trackColor}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={trackColor}
            disabled={bypass}
          />
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>Subtle</Text>
            <Text style={styles.rangeLabel}>Fully removed</Text>
          </View>
        </View>

        {/* ── Width ────────────────────────────────────  */}
        <View style={styles.card}>
          <SectionRule label="Width" hint={`Q ${selectedBand.q.toFixed(1)}`} />
          <Slider
            style={styles.secondarySlider}
            minimumValue={Q_MIN}
            maximumValue={Q_MAX}
            value={selectedBand.q}
            step={0.1}
            onValueChange={handleQChange}
            minimumTrackTintColor={trackColor}
            maximumTrackTintColor={c.sliderMax}
            thumbTintColor={thumbColorSecondary}
            disabled={bypass}
          />
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>Wide</Text>
            <Text style={styles.rangeLabel}>Narrow</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 32 },
    title: {
      fontFamily: SERIF_FONT,
      fontSize: 26,
      color: c.textPrimary,
      marginBottom: 6,
    },
    subtitle: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      marginBottom: 18,
    },

    bandRow: { marginBottom: 14 },
    bandRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bandChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardBg,
    },
    bandChipActive: {
      borderColor: c.accent,
      backgroundColor: c.qBadgeBg,
    },
    bandChipLabel: { paddingVertical: 8, paddingLeft: 14, paddingRight: 8 },
    bandChipText: {
      fontSize: 13,
      fontFamily: SANS_FONT,
      fontWeight: '600',
      color: c.textSecondary,
    },
    bandChipTextActive: { color: c.accent },
    bandChipRemove: { paddingVertical: 8, paddingRight: 12, paddingLeft: 2 },
    bandChipRemoveText: { fontSize: 15, color: c.textSecondary, lineHeight: 16 },
    bandAddBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bandAddText: { fontSize: 17, color: c.textSecondary, lineHeight: 19 },

    card: {
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 14,
    },
    freqValue: {
      fontSize: 40,
      fontFamily: SERIF_FONT,
      color: c.accent,
      textAlign: 'center',
      marginVertical: 6,
    },
    mainSlider: { width: '100%', height: 44 },
    secondarySlider: { width: '100%', height: 40, marginTop: 4 },
    rangeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    rangeLabel: {
      fontSize: 11,
      fontFamily: SANS_FONT,
      color: c.textSecondary,
    },
  });
}
