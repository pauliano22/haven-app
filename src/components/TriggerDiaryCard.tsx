import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useSoundDiary } from '../hooks/useSoundDiary';
import { FeatureResult } from '../utils/triggerAnalysis';
import { SectionRule } from './SectionRule';

interface Props {
  /** Local-logging consent has been given. */
  enabled: boolean;
}

function sentence(r: FeatureResult): string {
  if (!r.suggestive) return `${r.label}: no clear link so far.`;
  return `${r.label} tended to be ${r.auc > 0.5 ? 'higher' : 'lower'} when it hurt.`;
}

/**
 * Trigger diary: listen to the room's sound by frequency band, tap when
 * something hurts or feels fine, and see which features line up with the
 * taps. Only band levels are kept, never audio, and only on this phone.
 */
export function TriggerDiaryCard({ enabled }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const d = useSoundDiary(enabled);

  if (!enabled) return null;

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Sound diary" hint="stays on this phone" />
      <Text style={[styles.body, { color: c.textSecondary }]}>
        Leave this listening while you go about your day. When a sound hurts, tap “That hurt”. When
        something that could have hurt feels fine, tap “That was fine”. After a few days it shows
        what the painful moments had in common. It keeps how loud each pitch range was, never the
        sound itself.
      </Text>

      {!d.supported ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Listening works in the browser preview now. On the phone it arrives with the next
          phone build.
        </Text>
      ) : (
        <>
          <TouchableOpacity
            style={[d.listening ? styles.btnSecondary : styles.btn, d.listening ? { borderColor: c.border } : { backgroundColor: c.btnConnectBg }]}
            onPress={d.listening ? d.stop : d.start}
            accessibilityRole="button"
            accessibilityLabel={d.listening ? 'Stop listening' : 'Start listening'}
          >
            <Text style={d.listening ? [styles.btnSecondaryText, { color: c.textSecondary }] : [styles.btnText, { color: c.btnConnectText }]}>
              {d.listening ? 'Listening. Tap to stop' : 'Start listening'}
            </Text>
          </TouchableOpacity>
          {d.error !== null && <Text style={[styles.note, { color: c.statusDisconnected }]}>{d.error}</Text>}

          {d.listening && (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: c.btnConnectBg }]}
                onPress={() => d.mark('hurt')}
                accessibilityRole="button"
                accessibilityLabel="That hurt"
              >
                <Text style={[styles.btnText, { color: c.btnConnectText }]}>That hurt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: c.border }]}
                onPress={() => d.mark('fine')}
                accessibilityRole="button"
                accessibilityLabel="That was fine"
              >
                <Text style={[styles.btnSecondaryText, { color: c.textSecondary }]}>That was fine</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <Text style={[styles.count, { color: c.textSecondary }]}>
        {d.counts.hurt} hurt, {d.counts.fine} fine
      </Text>
      {d.counts.hurt + d.counts.fine > 0 && (
        <TouchableOpacity onPress={d.undo} accessibilityRole="button" accessibilityLabel="Undo the last tap">
          <Text style={[styles.link, { color: c.textSecondary }]}>Undo the last tap</Text>
        </TouchableOpacity>
      )}

      {d.analysis?.status === 'not_enough_data' && (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Results appear after at least {d.analysis.needEach} of each kind of tap, each with sound
          recorded just before it. So far: {d.analysis.hurtMarks} hurt, {d.analysis.fineMarks} fine.
        </Text>
      )}
      {d.analysis?.status === 'ok' && (
        <View style={styles.results}>
          <Text style={[styles.heading, { color: c.textPrimary }]}>What lines up with the taps</Text>
          {d.analysis.results.slice(0, 4).map((r) => (
            <Text key={r.id} style={[styles.note, { color: c.textPrimary }]}>
              {sentence(r)}
            </Text>
          ))}
          <Text style={[styles.note, { color: c.textSecondary }]}>
            Levels from a phone microphone are relative, not decibels of sound pressure. This
            describes patterns in your own taps. It does not diagnose anything, and a link in a
            few days of notes can be chance. Keep logging before acting on it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  body: { fontSize: 13, fontFamily: SANS_FONT, lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 13.5, fontFamily: SANS_FONT, fontWeight: '700' },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600' },
  count: { fontSize: 12, fontFamily: SANS_FONT, marginTop: 12 },
  link: { fontSize: 12, fontFamily: SERIF_FONT, textDecorationLine: 'underline', marginTop: 6 },
  note: { fontSize: 12.5, fontFamily: SANS_FONT, lineHeight: 18, marginTop: 10 },
  results: { marginTop: 8 },
  heading: { fontSize: 15, fontFamily: SERIF_FONT, marginTop: 8 },
});
