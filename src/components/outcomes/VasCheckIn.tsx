import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionRule } from '../SectionRule';

interface Props {
  onSave: (loudness: number, bother: number) => void;
}

interface ScaleProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
  accessibilityLabel: string;
}

function Scale({ label, value, onChange, low, high, accessibilityLabel }: ScaleProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.scale}>
      <Text style={[styles.scaleLabel, { color: c.textPrimary }]}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor={c.accent}
        maximumTrackTintColor={c.sliderMax}
        thumbTintColor={c.accent}
        accessibilityLabel={accessibilityLabel}
      />
      <View style={styles.rangeRow}>
        <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>{low}</Text>
        <Text style={[styles.value, { color: c.accent }]}>{value}</Text>
        <Text style={[styles.rangeLabel, { color: c.textSecondary }]}>{high}</Text>
      </View>
    </View>
  );
}

/** The weekly two-question check-in (constants/outcomes.ts, VAS_INTERVAL_MS). */
export function VasCheckIn({ onSave }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [loudness, setLoudness] = useState(5);
  const [bother, setBother] = useState(5);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Weekly check-in" hint="two questions" />
      <Text style={[styles.title, { color: c.textPrimary }]}>How has this week been?</Text>
      <Scale
        label="How loud has your sound been?"
        value={loudness}
        onChange={setLoudness}
        low="Silent"
        high="As loud as it gets"
        accessibilityLabel="Loudness of your sound this week, 0 to 10"
      />
      <Scale
        label="How much has it bothered you?"
        value={bother}
        onChange={setBother}
        low="Not at all"
        high="Extremely"
        accessibilityLabel="How much it bothered you this week, 0 to 10"
      />
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: c.btnConnectBg }]}
        onPress={() => onSave(loudness, bother)}
        accessibilityRole="button"
        accessibilityLabel="Save this week's check-in"
      >
        <Text style={[styles.saveText, { color: c.btnConnectText }]}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  title: { fontSize: 20, fontFamily: SERIF_FONT, marginBottom: 12 },
  scale: { marginBottom: 12 },
  scaleLabel: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600', marginBottom: 2 },
  slider: { width: '100%', height: 40 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rangeLabel: { fontSize: 11, fontFamily: SANS_FONT },
  value: { fontSize: 15, fontFamily: SERIF_FONT },
  saveBtn: { borderRadius: RADIUS_SM, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 14, fontFamily: SANS_FONT, fontWeight: '700' },
});
