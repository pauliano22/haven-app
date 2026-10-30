import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDemoControls } from '../context/DemoBleProvider';
import { useTheme } from '../context/ThemeContext';
import { resetDemoData } from '../services/demoSeed';

/**
 * Always-visible strip in demo mode so nobody mistakes it for a real device
 * or real history. Renders nothing outside demo mode.
 */
export function DemoBanner() {
  const demo = useDemoControls();
  const { theme } = useTheme();
  const c = theme.colors;
  if (!demo) return null;

  const reset = async () => {
    await resetDemoData();
    if (Platform.OS === 'web') globalThis.location?.reload();
  };

  return (
    <View
      style={[styles.bar, { backgroundColor: c.cardBgDeep, borderBottomColor: c.border }]}
      accessibilityRole="summary"
    >
      <Text style={[styles.label, { color: c.accent }]}>Demo</Text>
      <Text style={[styles.text, { color: c.textSecondary }]} numberOfLines={2}>
        Simulated device · example data · battery {demo.battery}%
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => demo.setMuted(!demo.muted)}
          accessibilityRole="button"
          accessibilityLabel={demo.muted ? 'Unmute demo tones' : 'Mute demo tones'}
          style={[styles.btn, { borderColor: c.border }]}
        >
          <Text style={[styles.btnText, { color: c.textPrimary }]}>{demo.muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel="Reset the demo's example data"
          style={[styles.btn, { borderColor: c.border }]}
        >
          <Text style={[styles.btnText, { color: c.textPrimary }]}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  text: {
    flex: 1,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  btnText: {
    fontSize: 12,
  },
});
