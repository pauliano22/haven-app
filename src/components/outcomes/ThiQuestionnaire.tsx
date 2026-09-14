import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { ThiAnswer } from '../../types';
import { THI_ITEMS } from '../../utils/thi';
import { SectionRule } from '../SectionRule';

interface Props {
  onSave: (answers: ThiAnswer[]) => void;
  onCancel: () => void;
}

const OPTIONS: { key: ThiAnswer; label: string }[] = [
  { key: 'yes', label: 'Yes' },
  { key: 'sometimes', label: 'Sometimes' },
  { key: 'no', label: 'No' },
];

/**
 * Tinnitus Handicap Inventory, one item at a time. Item WORDING is a
 * placeholder pending the licensing check in utils/thi.ts; the flow,
 * scoring and persistence are real. Partial runs are never saved.
 */
export function ThiQuestionnaire({ onSave, onCancel }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [answers, setAnswers] = useState<(ThiAnswer | null)[]>(() => THI_ITEMS.map(() => null));
  const [index, setIndex] = useState(0);
  const item = THI_ITEMS[index];
  const answered = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const complete = answered === THI_ITEMS.length;

  const choose = (a: ThiAnswer) => {
    setAnswers((prev) => prev.map((v, i) => (i === index ? a : v)));
    if (index < THI_ITEMS.length - 1) setIndex(index + 1);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Tinnitus questionnaire" hint={`${answered}/${THI_ITEMS.length}`} />
      <Text style={[styles.notice, { color: c.textSecondary }]}>
        Placeholder wording — the standard 25-item inventory’s text is pending a
        licensing check (see the note in the code). Scoring and history are real.
      </Text>
      <Text style={[styles.prompt, { color: c.textPrimary }]}>{item.prompt}</Text>
      <View style={styles.row}>
        {OPTIONS.map((o) => {
          const selected = answers[index] === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[
                styles.option,
                { borderColor: c.border },
                selected && { backgroundColor: c.btnConnectBg, borderColor: c.btnConnectBg },
              ]}
              onPress={() => choose(o.key)}
              accessibilityRole="button"
              accessibilityLabel={`${o.label} for question ${index + 1}`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: selected ? c.btnConnectText : c.textSecondary },
                  selected && { fontWeight: '700' },
                ]}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous question"
        >
          <Text style={[styles.navText, { color: index === 0 ? c.sliderDisabled : c.textSecondary }]}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIndex(Math.min(THI_ITEMS.length - 1, index + 1))}
          disabled={index === THI_ITEMS.length - 1}
          accessibilityRole="button"
          accessibilityLabel="Next question"
        >
          <Text
            style={[
              styles.navText,
              { color: index === THI_ITEMS.length - 1 ? c.sliderDisabled : c.textSecondary },
            ]}
          >
            Next ›
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: complete ? c.btnConnectBg : c.sliderDisabled }]}
        disabled={!complete}
        onPress={() => complete && onSave(answers as ThiAnswer[])}
        accessibilityRole="button"
        accessibilityLabel="Save questionnaire"
      >
        <Text style={[styles.saveText, { color: c.btnConnectText }]}>
          {complete ? 'Save' : `Answer all ${THI_ITEMS.length} to save`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel questionnaire">
        <Text style={[styles.cancelLink, { color: c.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  notice: { fontSize: 11.5, fontFamily: SANS_FONT, lineHeight: 16, marginBottom: 12 },
  prompt: { fontSize: 18, fontFamily: SERIF_FONT, lineHeight: 25, marginBottom: 14, minHeight: 50 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  option: { flex: 1, borderWidth: 1, borderRadius: RADIUS_SM, paddingVertical: 12, alignItems: 'center' },
  optionText: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  navText: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600' },
  saveBtn: { borderRadius: RADIUS_SM, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 14, fontFamily: SANS_FONT, fontWeight: '700' },
  cancelLink: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});
