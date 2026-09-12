import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { OctaveCandidates, OctaveChoice } from '../../utils/pitchMatch';
import { SectionRule } from '../SectionRule';

interface Props {
  f0: number;
  candidates: OctaveCandidates;
  playingWhich: OctaveChoice | null;
  played: Record<OctaveChoice, boolean>;
  levelNote?: string;
  onPlay: (which: OctaveChoice) => void;
  onChoose: (which: OctaveChoice) => void;
  onAbort: () => void;
}

const LABELS: Record<OctaveChoice, string> = {
  lower: 'Lower',
  match: 'Your match',
  upper: 'Higher',
};

/**
 * The final octave check after pitch bisection has converged: the matched
 * tone against its neighbours one octave down and up. Same play/choose
 * pattern as PitchTrialStep; a neighbour that falls outside the searchable
 * range is simply not offered.
 */
export function OctaveCheckStep({
  f0,
  candidates,
  playingWhich,
  played,
  levelNote,
  onPlay,
  onChoose,
  onAbort,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const options: OctaveChoice[] = [];
  if (candidates.lowerHz !== null) options.push('lower');
  options.push('match');
  if (candidates.upperHz !== null) options.push('upper');

  const anyPlayed = options.some((o) => played[o]);

  const renderOption = (which: OctaveChoice) => {
    const isPlaying = playingWhich === which;
    const isMatch = which === 'match';
    return (
      <View
        key={which}
        style={[
          styles.option,
          { backgroundColor: c.cardBg, borderColor: isMatch ? c.accent : c.border },
        ]}
      >
        <Text style={[styles.optionLabel, { color: isMatch ? c.accent : c.textSecondary }]}>
          {LABELS[which]}
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
          accessibilityLabel={`Play the ${LABELS[which].toLowerCase()} sound`}
        >
          <Text style={[styles.playBtnText, { color: c.btnConnectText }]}>
            {isPlaying ? 'Playing…' : '▶ Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.chooseBtn,
            { borderColor: played[which] ? c.accent : c.border },
            !played[which] && styles.chooseBtnDisabled,
          ]}
          onPress={() => onChoose(which)}
          disabled={!played[which]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Choose the ${LABELS[which].toLowerCase()} sound`}
        >
          <Text
            style={[styles.chooseBtnText, { color: played[which] ? c.accent : c.textSecondary }]}
          >
            This one
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <SectionRule label="One last check" hint="octave" />
        <Text style={[styles.instruction, { color: c.textPrimary }]}>
          Sounds an octave apart can feel like the same pitch. Play your match
          and its neighbours, then pick the one that's really closest.
        </Text>
        {levelNote && (
          <Text style={[styles.note, { color: c.textSecondary }]}>{levelNote}</Text>
        )}

        <View style={styles.optionsRow}>{options.map(renderOption)}</View>

        {!anyPlayed && (
          <Text style={[styles.hint, { color: c.textSecondary }]}>
            Play at least one to choose. Your match is {formatFreq(f0)}.
          </Text>
        )}
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

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz} Hz`;
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
  note: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    lineHeight: 17,
    marginTop: -8,
    marginBottom: 14,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 11,
    fontFamily: SANS_FONT,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'center',
  },
  playBtn: {
    width: '100%',
    borderRadius: RADIUS_SM,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  playBtnText: {
    fontSize: 13,
    fontFamily: SANS_FONT,
    fontWeight: '700',
  },
  chooseBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: RADIUS_SM,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chooseBtnDisabled: {
    opacity: 0.5,
  },
  chooseBtnText: {
    fontSize: 12.5,
    fontFamily: SANS_FONT,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    marginTop: 14,
    textAlign: 'center',
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
