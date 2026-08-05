import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MONO_FONT, RADIUS, RADIUS_SM, SANS_FONT } from '../../constants/theme';
import { MAX_TONE_LEVEL_DB } from '../../constants/safety';
import { useTheme } from '../../context/ThemeContext';
import { LdlResult } from '../../types';
import { SectionRule } from '../SectionRule';

/** LDL at or below this is treated as a sensitive ("painful") frequency. */
export const SENSITIVE_LDL_THRESHOLD_DB = 70;

interface Props {
  results: LdlResult[];
  onApply: () => void;
  onRedo: () => void;
  onClose: () => void;
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`;
}

export function LdlResults({ results, onApply, onRedo, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const sensitive = results.filter(
    (r) => r.ldlDb !== null && r.ldlDb <= SENSITIVE_LDL_THRESHOLD_DB,
  );

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <SectionRule label="Results" hint={`${results.length} tones`} />
      <Text style={[styles.title, { color: c.textPrimary }]}>Your profile</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>
        Frequencies marked ● became uncomfortable at lower volumes and are good
        candidates for dampening.
      </Text>

      {results.map((r) => {
        const isSensitive =
          r.ldlDb !== null && r.ldlDb <= SENSITIVE_LDL_THRESHOLD_DB;
        return (
          <View
            key={r.f0}
            style={[styles.row, { borderBottomColor: c.borderDeep }]}
          >
            <Text
              style={[
                styles.rowFreq,
                { color: isSensitive ? c.statusScanning : c.textPrimary },
              ]}
            >
              {isSensitive ? '● ' : '  '}
              {formatFreq(r.f0)}
            </Text>
            <Text style={[styles.rowLdl, { color: c.textSecondary }]}>
              {r.ldlDb === null
                ? `comfortable to ${MAX_TONE_LEVEL_DB} dB`
                : `uncomfortable at ${Math.round(r.ldlDb)} dB`}
            </Text>
          </View>
        );
      })}

      {sensitive.length > 0 ? (
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: c.btnConnectBg }]}
          onPress={onApply}
          activeOpacity={0.8}
        >
          <Text style={[styles.applyText, { color: c.btnConnectText }]}>
            APPLY {sensitive.length} DAMPENING BAND{sensitive.length > 1 ? 'S' : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.noneText, { color: c.textSecondary }]}>
          No sensitive frequencies detected — nothing to apply.
        </Text>
      )}

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onRedo}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            Redo test
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: c.border }]}
          onPress={onClose}
        >
          <Text style={[styles.secondaryText, { color: c.textSecondary }]}>
            Back to dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    lineHeight: 18,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowFreq: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: MONO_FONT,
  },
  rowLdl: {
    fontSize: 11,
    fontFamily: MONO_FONT,
  },
  applyBtn: {
    borderRadius: RADIUS_SM,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  applyText: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  noneText: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    textAlign: 'center',
    marginTop: 18,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS_SM,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: MONO_FONT,
    fontWeight: '600',
  },
});
