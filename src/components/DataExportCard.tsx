import React, { useCallback, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getConsent } from '../services/ConsentStore';
import { getExposureLog } from '../services/ExposureLog';
import { getFilterProfile } from '../services/FilterStore';
import { getLdlHistory } from '../services/LdlHistoryStore';
import { getMatchHistory } from '../services/MatchHistoryStore';
import { getThiRuns, getVasCheckIns } from '../services/OutcomeStore';
import { getTolerancePlan } from '../services/TolerancePlanStore';
import { getTrial } from '../services/TrialStore';
import { buildExportCsv, buildExportJson, ExportBundle } from '../utils/exportData';
import { SectionRule } from './SectionRule';

interface Props {
  onWithdraw: () => void;
}

async function gatherBundle(): Promise<ExportBundle> {
  const [filterProfile, tolerancePlan, ldlRuns, matchRuns, vasCheckIns, thiRuns, trial, exposure, consent] =
    await Promise.all([
      getFilterProfile(),
      getTolerancePlan(),
      getLdlHistory(),
      getMatchHistory(),
      getVasCheckIns(),
      getThiRuns(),
      getTrial(),
      getExposureLog(),
      getConsent(),
    ]);
  return { filterProfile, tolerancePlan, ldlRuns, matchRuns, vasCheckIns, thiRuns, trial, exposure, consent };
}

/**
 * "Share my data": the only way anything leaves the phone. Uses the platform
 * share sheet with the export as text (no extra native modules), so the user
 * chooses the destination — a clinician's email, Files, a notes app.
 */
export function DataExportCard({ onWithdraw }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [busy, setBusy] = useState(false);

  const share = useCallback(async (format: 'json' | 'csv') => {
    setBusy(true);
    try {
      const bundle = await gatherBundle();
      const message = format === 'json' ? buildExportJson(bundle) : buildExportCsv(bundle);
      const stamp = new Date().toISOString().slice(0, 10);
      await Share.share({ message, title: `haven-export-${stamp}.${format}` });
    } catch {
      if (Platform.OS === 'web') {
        Alert.alert('Not available in the browser preview', 'Sharing works on the phone build.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmWithdraw = useCallback(() => {
    Alert.alert(
      'Stop keeping a record?',
      'This turns logging off and deletes everything recorded so far on this phone. Your softening settings are kept.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Turn off and delete', style: 'destructive', onPress: onWithdraw },
      ],
    );
  }, [onWithdraw]);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Your data" hint="stays on this phone" />
      <Text style={[styles.body, { color: c.textSecondary }]}>
        Everything the app has recorded — settings, tests, check-ins, the trial, and when the
        device was connected — as one file. Useful to bring to an audiologist or doctor.
        Levels in it are the app’s commanded values, not measured sound pressure.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: c.btnConnectBg }]}
          onPress={() => share('json')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Share my data as JSON"
        >
          <Text style={[styles.btnText, { color: c.btnConnectText }]}>Share (full)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: c.border }]}
          onPress={() => share('csv')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Share my data as a spreadsheet"
        >
          <Text style={[styles.btnSecondaryText, { color: c.textSecondary }]}>Share (spreadsheet)</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={confirmWithdraw} accessibilityRole="button" accessibilityLabel="Stop keeping a record and delete it">
        <Text style={[styles.withdraw, { color: c.statusDisconnected }]}>Turn off and delete my record</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 18, marginBottom: 14 },
  body: { fontSize: 13, fontFamily: SANS_FONT, lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 13.5, fontFamily: SANS_FONT, fontWeight: '700' },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 13, fontFamily: SANS_FONT, fontWeight: '600' },
  withdraw: {
    fontSize: 12,
    fontFamily: SERIF_FONT,
    textAlign: 'center',
    marginTop: 14,
    textDecorationLine: 'underline',
  },
});
