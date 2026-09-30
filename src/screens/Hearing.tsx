import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConnectionBar } from '../components/ConnectionBar';
import { InsightsSummaryCard } from '../components/InsightsSummaryCard';
import { ColorPalette, RADIUS, RADIUS_SM, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { useHearingInsights } from '../hooks/useHearingInsights';
import { HEARING_TESTS_DISABLED_TEXT, hearingTestsAllowed } from '../utils/deviceMessages';
import { hasRealData } from '../utils/insights';
import { CheckIn } from './CheckIn';
import { LdlTest } from './LdlTest';
import { PitchMatchTest } from './PitchMatchTest';

type Tool = 'none' | 'ldl' | 'match' | 'checkin';

interface ToolCardProps {
  title: string;
  body: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  /** False = shown but not startable (safety gate); default true. */
  enabled?: boolean;
}

function ToolCard({ title, body, onPress, styles, enabled = true }: ToolCardProps) {
  return (
    <TouchableOpacity
      style={[styles.toolCard, !enabled && styles.toolCardDisabled]}
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.toolTitle}>{title}</Text>
      <Text style={styles.toolBody}>{body}</Text>
      <Text style={styles.toolArrow}>{enabled ? 'Start ›' : 'Unavailable'}</Text>
    </TouchableOpacity>
  );
}

export function Hearing() {
  const [tool, setTool] = useState<Tool>('none');
  const { theme } = useTheme();
  const { deviceInfo } = useBle();
  const c = theme.colors;
  const styles = makeStyles(c);

  // No LlmClient anywhere in this app yet -- see docs/llm-summary.md. This
  // is the deterministic-only mode, permanent until a real backend exists,
  // not a temporary stub.
  const { loading: insightsLoading, insights, summaryText, summarySource } = useHearingInsights();

  // Safety gate (docs/safety.md): the firmware's boot event says which output
  // path it was built with. A bench build without the limiter must not play
  // test tones. The tone hooks refuse independently; this just explains why.
  const testsAllowed = hearingTestsAllowed(deviceInfo);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tool === 'ldl' && <LdlTest onBack={() => setTool('none')} />}
        {tool === 'match' && <PitchMatchTest onBack={() => setTool('none')} />}
        {tool === 'checkin' && <CheckIn onBack={() => setTool('none')} />}

        {tool === 'none' && (
          <>
            <Text style={styles.title}>Hearing tools</Text>
            <Text style={styles.subtitle}>Two guided tests, and a way to see whether any of it is helping.</Text>

            <ConnectionBar />

            {!testsAllowed && (
              <View style={styles.gateBox} accessibilityRole="alert">
                <Text style={styles.gateTitle}>Hearing tests disabled</Text>
                <Text style={styles.gateText}>{HEARING_TESTS_DISABLED_TEXT}</Text>
              </View>
            )}

            {!insightsLoading && hasRealData(insights) && (
              <InsightsSummaryCard summaryText={summaryText} summarySource={summarySource} />
            )}

            <ToolCard
              title="Loudness comfort test"
              body="Find the sounds that become uncomfortable, and soften them before they bother you."
              onPress={() => setTool('ldl')}
              styles={styles}
              enabled={testsAllowed}
            />
            <ToolCard
              title="Match your sound"
              body="For a ringing, buzzing, or hissing that isn't really there — find its pitch and try softening it."
              onPress={() => setTool('match')}
              styles={styles}
              enabled={testsAllowed}
            />
            <ToolCard
              title="Check in"
              body="Short weekly and monthly check-ins, and an optional four-week on/off trial, so you can see what softening actually does for you."
              onPress={() => setTool('checkin')}
              styles={styles}
            />
          </>
        )}
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
    toolCard: {
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 14,
    },
    toolCardDisabled: {
      opacity: 0.55,
    },
    gateBox: {
      borderWidth: 1,
      borderColor: c.statusDisconnected,
      borderRadius: RADIUS_SM,
      padding: 14,
      marginBottom: 14,
    },
    gateTitle: {
      fontFamily: SANS_FONT,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: c.statusDisconnected,
      marginBottom: 6,
    },
    gateText: {
      fontFamily: SANS_FONT,
      fontSize: 12,
      lineHeight: 18,
      color: c.textSecondary,
    },
    toolTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 19,
      color: c.textPrimary,
      marginBottom: 6,
    },
    toolBody: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      lineHeight: 19,
      color: c.textSecondary,
      marginBottom: 12,
    },
    toolArrow: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      fontWeight: '700',
      color: c.accent,
    },
  });
}
