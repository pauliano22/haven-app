import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConsentCard } from '../components/ConsentCard';
import { DataExportCard } from '../components/DataExportCard';
import { Nof1Results } from '../components/nof1/Nof1Results';
import { OutcomeHistory } from '../components/outcomes/OutcomeHistory';
import { ThiQuestionnaire } from '../components/outcomes/ThiQuestionnaire';
import { VasCheckIn } from '../components/outcomes/VasCheckIn';
import { SectionRule } from '../components/SectionRule';
import { NOF1_TRIAL_DAYS } from '../constants/outcomes';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useConsent } from '../hooks/useConsent';
import { useNof1Trial } from '../hooks/useNof1Trial';
import { useOutcomes } from '../hooks/useOutcomes';
import { ThiAnswer } from '../types';

interface Props {
  onBack?: () => void;
}

/**
 * The third Hearing tool: the evidence programme. Weekly VAS, the THI at
 * baseline and monthly, the opt-in N-of-1 trial, history, and export. All
 * gated on local-logging consent (ConsentCard) — without the exposure log
 * none of these numbers can be interpreted, so we don't collect them alone.
 */
export function CheckIn({ onBack }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { consented, loaded: consentLoaded, accept, withdraw } = useConsent();
  const outcomes = useOutcomes();
  const trial = useNof1Trial();
  const [thiOpen, setThiOpen] = useState(false);
  const [vasSavedNow, setVasSavedNow] = useState(false);

  const handleSaveVas = useCallback(
    (loudness: number, bother: number) => {
      outcomes.recordVas(loudness, bother);
      setVasSavedNow(true);
    },
    [outcomes],
  );

  const handleSaveThi = useCallback(
    (answers: ThiAnswer[]) => {
      outcomes.recordThi(answers);
      setThiOpen(false);
    },
    [outcomes],
  );

  return (
    <View>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backLink} accessibilityRole="button">
          <Text style={[styles.backText, { color: c.textSecondary }]}>‹ All hearing tools</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.title, { color: c.textPrimary }]}>Check in</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>
        Is Haven actually helping? These short check-ins are how you and the app find out.
      </Text>

      {consentLoaded && !consented && <ConsentCard onAccept={accept} onDecline={onBack} />}

      {consented && (
        <>
          {/* Weekly VAS */}
          {outcomes.vasDue && !vasSavedNow ? (
            <VasCheckIn onSave={handleSaveVas} />
          ) : (
            <View style={[styles.quiet, { borderColor: c.border }]}>
              <Text style={[styles.quietText, { color: c.textSecondary }]}>
                {vasSavedNow ? 'This week’s check-in is saved.' : 'Weekly check-in done — next one in a few days.'}
              </Text>
            </View>
          )}

          {/* THI */}
          {thiOpen ? (
            <ThiQuestionnaire onSave={handleSaveThi} onCancel={() => setThiOpen(false)} />
          ) : (
            <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <SectionRule label="Tinnitus questionnaire" hint={outcomes.thi.length === 0 ? 'baseline' : 'monthly'} />
              <Text style={[styles.body, { color: c.textSecondary }]}>
                The 25-question inventory clinicians use to track tinnitus over time. About three
                minutes; once at the start, then monthly.
              </Text>
              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: outcomes.thiDue ? c.btnConnectBg : c.sliderDisabled },
                ]}
                onPress={() => setThiOpen(true)}
                disabled={!outcomes.thiDue}
                accessibilityRole="button"
                accessibilityLabel="Start the tinnitus questionnaire"
              >
                <Text style={[styles.btnText, { color: c.btnConnectText }]}>
                  {outcomes.thiDue ? (outcomes.thi.length === 0 ? 'Take the baseline' : 'Take this month’s') : 'Done for this month'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* N-of-1 */}
          {trial.loaded && trial.trial === null && (
            <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <SectionRule label="Does softening help you?" hint={`${NOF1_TRIAL_DAYS}-day trial`} />
              <Text style={[styles.body, { color: c.textSecondary }]}>
                The honest way to know is to compare days with softening on against days with it
                paused. For four weeks the app will suggest, in a shuffled order, which kind of day
                each is, and ask you one question each evening. You can always switch protection
                yourself — the app just notes it. Then you see the two averages side by side.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: c.btnConnectBg }]}
                onPress={trial.startTrial}
                accessibilityRole="button"
                accessibilityLabel="Start the four-week trial"
              >
                <Text style={[styles.btnText, { color: c.btnConnectText }]}>Start the trial</Text>
              </TouchableOpacity>
            </View>
          )}
          {trial.trial !== null && trial.summary && (
            <>
              <Nof1Results summary={trial.summary} complete={trial.complete} />
              <TouchableOpacity
                onPress={trial.complete ? trial.clearTrial : trial.stopTrial}
                accessibilityRole="button"
                accessibilityLabel={trial.complete ? 'Clear the finished trial' : 'Stop the trial'}
              >
                <Text style={[styles.link, { color: c.textSecondary }]}>
                  {trial.complete ? 'Clear this trial to start another' : 'Stop the trial early'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <OutcomeHistory vas={outcomes.vas} thi={outcomes.thi} />

          <DataExportCard onWithdraw={() => { withdraw(); onBack?.(); }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: { marginBottom: 10 },
  backText: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600' },
  title: { fontFamily: SERIF_FONT, fontSize: 26, marginBottom: 6 },
  subtitle: { fontFamily: SANS_FONT, fontSize: 13, lineHeight: 19, marginBottom: 18 },
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  body: { fontSize: 13, fontFamily: SANS_FONT, lineHeight: 19, marginBottom: 14 },
  btn: { borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 13.5, fontFamily: SANS_FONT, fontWeight: '700' },
  quiet: { borderWidth: 1, borderRadius: RADIUS_SM, padding: 12, marginBottom: 14 },
  quietText: { fontSize: 12.5, fontFamily: SANS_FONT, textAlign: 'center' },
  link: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginBottom: 18,
  },
});
