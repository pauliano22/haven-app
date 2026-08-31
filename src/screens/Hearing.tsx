import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ConnectionBar } from '../components/ConnectionBar';
import { ColorPalette, RADIUS, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { LdlTest } from './LdlTest';
import { PitchMatchTest } from './PitchMatchTest';

type Tool = 'none' | 'ldl' | 'match';

interface ToolCardProps {
  title: string;
  body: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}

function ToolCard({ title, body, onPress, styles }: ToolCardProps) {
  return (
    <TouchableOpacity
      style={styles.toolCard}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.toolTitle}>{title}</Text>
      <Text style={styles.toolBody}>{body}</Text>
      <Text style={styles.toolArrow}>Start ›</Text>
    </TouchableOpacity>
  );
}

export function Hearing() {
  const [tool, setTool] = useState<Tool>('none');
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = makeStyles(c);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tool === 'ldl' && <LdlTest onBack={() => setTool('none')} />}
        {tool === 'match' && <PitchMatchTest onBack={() => setTool('none')} />}

        {tool === 'none' && (
          <>
            <Text style={styles.title}>Hearing tools</Text>
            <Text style={styles.subtitle}>Two guided tests, each about a minute.</Text>

            <ConnectionBar />

            <ToolCard
              title="Loudness comfort test"
              body="Find the sounds that become uncomfortable, and soften them before they bother you."
              onPress={() => setTool('ldl')}
              styles={styles}
            />
            <ToolCard
              title="Match your sound"
              body="For a ringing, buzzing, or hissing that isn't really there — find its pitch and try softening it."
              onPress={() => setTool('match')}
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
