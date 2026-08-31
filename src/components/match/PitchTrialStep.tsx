import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  trialIndex: number;
  playingWhich: 'A' | 'B' | null;
  playedA: boolean;
  playedB: boolean;
  onPlay: (which: 'A' | 'B') => void;
  onChoose: (which: 'A' | 'B') => void;
  onAbort: () => void;
}

export function PitchTrialStep({
  trialIndex,
  playingWhich,
  playedA,
  playedB,
  onPlay,
  onChoose,
  onAbort,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const renderOption = (which: 'A' | 'B', played: boolean) => {
    const isPlaying = playingWhich === which;
    return (
      <View style={[styles.option, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[styles.optionLabel, { color: c.textSecondary }]}>
          Sound {which}
        </Text>
        <TouchableOpacity
          style={[
            styles.playBtn,
            { backgroundColor: isPlaying ? c.sliderDisabled : c.btnConnectBg },
          ]}
          onPress={() => onPlay(which)}
          disabled={isPlaying}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Play sound ${which}`}
        >
          <Text style={[styles.playBtnText, { color: c.btnConnectText }]}>
            {isPlaying ? 'Playing…' : '▶ Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.chooseBtn,
            { borderColor: played ? c.accent : c.border },
            !played && styles.chooseBtnDisabled,
          ]}
          onPress={() => onChoose(which)}
          disabled={!played}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Choose sound ${which} as closer to what I hear`}
        >
          <Text
            style={[
              styles.chooseBtnText,
              { color: played ? c.accent : c.textSecondary },
            ]}
          >
            This is closer
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <SectionRule label={`Comparison ${trialIndex + 1}`} hint="listening" />
        <Text style={[styles.instruction, { color: c.textPrimary }]}>
          Play both sounds, then choose the one that's closer to what you
          hear.
        </Text>

        <View style={styles.optionsRow}>
          {renderOption('A', playedA)}
          {renderOption('B', playedB)}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.abortBtn, { borderColor: c.border }]}
        onPress={onAbort}
        accessibilityRole="button"
        accessibilityLabel="End test"
      >
        <Text style={[styles.abortText, { color: c.textSecondary }]}>End test</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 18,
  },
  instruction: {
    fontSize: 15,
    fontFamily: SERIF_FONT,
    lineHeight: 22,
    marginBottom: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  playBtn: {
    width: '100%',
    borderRadius: RADIUS_SM,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  playBtnText: {
    fontSize: 14,
    fontFamily: SANS_FONT,
    fontWeight: '700',
  },
  chooseBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: RADIUS_SM,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chooseBtnDisabled: {
    opacity: 0.5,
  },
  chooseBtnText: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
  abortBtn: {
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 13,
    alignItems: 'center',
  },
  abortText: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
});
