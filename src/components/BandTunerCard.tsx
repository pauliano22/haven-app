import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BandTunerState, TunerPhase } from '../hooks/useBandTuner';
import { ColorPalette, RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { SectionRule } from './SectionRule';

interface Props {
  tuner: BandTunerState;
}

// Rough total, for the progress label -- the search can finish a little
// earlier or later depending on the answers, so this is "about", not exact.
const APPROX_TOTAL_COMPARISONS = 10;

function phaseLabel(phase: TunerPhase): string {
  return phase === 'depth' ? 'softening depth' : 'width';
}

/**
 * The live A/B step of the preference-guided tuner (see useBandTuner.ts).
 * Rendered only while a search is active -- the entry point that calls
 * tuner.start() lives in Tune.tsx alongside the manual sliders.
 */
export function BandTunerCard({ tuner }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = makeStyles(c);

  if (!tuner.active || !tuner.pair) return null;

  return (
    <View style={styles.card}>
      <SectionRule
        label="Finding your setting"
        hint={`comparison ${tuner.comparisonCount + 1} of ~${APPROX_TOTAL_COMPARISONS}`}
      />
      <Text style={styles.question}>Which sounds better for {phaseLabel(tuner.phase)}?</Text>
      <Text style={styles.hint}>Tap either option to switch, listen for a moment, then choose.</Text>

      <View style={styles.optionRow}>
        <TouchableOpacity
          style={[styles.option, tuner.activeChoice === 'a' && styles.optionActive]}
          onPress={() => tuner.playOption('a')}
          accessibilityRole="button"
          accessibilityLabel="Listen to option A"
        >
          <Text style={styles.optionLabel}>A</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, tuner.activeChoice === 'b' && styles.optionActive]}
          onPress={() => tuner.playOption('b')}
          accessibilityRole="button"
          accessibilityLabel="Listen to option B"
        >
          <Text style={styles.optionLabel}>B</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[styles.choiceBtn, styles.choiceBtnPrimary]}
          onPress={() => tuner.choose('a')}
          accessibilityRole="button"
          accessibilityLabel="Prefer A"
        >
          <Text style={styles.choiceTextPrimary}>Prefer A</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.choiceBtn}
          onPress={() => tuner.choose('same')}
          accessibilityRole="button"
          accessibilityLabel="About the same"
        >
          <Text style={styles.choiceText}>About the same</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choiceBtn, styles.choiceBtnPrimary]}
          onPress={() => tuner.choose('b')}
          accessibilityRole="button"
          accessibilityLabel="Prefer B"
        >
          <Text style={styles.choiceTextPrimary}>Prefer B</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={tuner.cancel} accessibilityRole="button" accessibilityLabel="Cancel and keep the original setting">
        <Text style={styles.cancelText}>Cancel — keep what I had</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.accent,
      padding: 18,
      marginBottom: 14,
    },
    question: {
      fontSize: 17,
      fontFamily: SERIF_FONT,
      color: c.textPrimary,
      marginTop: 8,
      marginBottom: 4,
    },
    hint: {
      fontSize: 12,
      fontFamily: SANS_FONT,
      color: c.textSecondary,
      marginBottom: 14,
    },
    optionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    option: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS_SM,
      paddingVertical: 22,
      alignItems: 'center',
    },
    optionActive: {
      borderColor: c.accent,
      backgroundColor: c.qBadgeBg,
    },
    optionLabel: {
      fontSize: 20,
      fontFamily: SERIF_FONT,
      color: c.textPrimary,
    },
    choiceRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    choiceBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS_SM,
      paddingVertical: 12,
      alignItems: 'center',
    },
    choiceBtnPrimary: {
      backgroundColor: c.btnConnectBg,
      borderWidth: 0,
    },
    choiceText: {
      fontSize: 12,
      fontFamily: SANS_FONT,
      fontWeight: '600',
      color: c.textSecondary,
    },
    choiceTextPrimary: {
      fontSize: 12,
      fontFamily: SANS_FONT,
      fontWeight: '700',
      color: c.btnConnectText,
    },
    cancelText: {
      fontSize: 12,
      fontFamily: SANS_FONT,
      color: c.textSecondary,
      textAlign: 'center',
    },
  });
}
