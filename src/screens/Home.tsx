import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ColorPalette, RADIUS, SANS_FONT, SERIF_FONT } from '../constants/theme';
import { useBle } from '../context/BleContext';
import { useFilters } from '../context/FilterContext';
import { useTheme } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Tab } from '../navigation';

function formatChip(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k` : `${Math.round(hz)}`;
}

interface Props {
  onNavigate: (tab: Tab) => void;
}

export function Home({ onNavigate }: Props) {
  const { status, queuedCount, connect, disconnect } = useBle();
  const { bands, bypass, setBypass } = useFilters();
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(c), [c]);

  const isConnected = status === 'connected';
  const isBusy = status === 'scanning' || status === 'connecting' || status === 'reconnecting';
  const protecting = isConnected && !bypass;

  // The orb breathes only while protecting — stillness itself signals "paused".
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!protecting || reduceMotion) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [protecting, reduceMotion, breath]);

  const orbScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  const handleOrbPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (isConnected) {
      setBypass(!bypass);
    } else if (!isBusy) {
      connect();
    }
  };

  const stateTitle = !isConnected
    ? isBusy
      ? 'Connecting…'
      : 'Not connected'
    : bypass
      ? 'Paused'
      : 'Protected';

  const stateSub = !isConnected
    ? isBusy
      ? 'Looking for your Haven'
      : 'Tap the circle to connect'
    : bypass
      ? 'Tap the circle to resume'
      : `${bands.length} ${bands.length === 1 ? 'sound' : 'sounds'} softened — tap to pause`;

  const orbActive = protecting;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>Haven</Text>
          <TouchableOpacity
            style={styles.themeToggle}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Toggle light or dark theme"
          >
            <Text style={styles.themeToggleIcon}>{theme.dark ? '◐' : '◑'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── The orb ─────────────────────────────────── */}
        <View style={styles.hero}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOrbPress}
            accessibilityRole="button"
            accessibilityLabel={
              isConnected
                ? bypass
                  ? 'Resume protection'
                  : 'Pause protection'
                : 'Connect to your Haven device'
            }
          >
            <View style={styles.orbWrap}>
              {orbActive && (
                <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
              )}
              <View style={[styles.ring, !orbActive && styles.ringMuted]} />
              <Animated.View
                style={[
                  styles.orb,
                  orbActive ? styles.orbActive : isConnected ? styles.orbPaused : styles.orbOffline,
                  { transform: [{ scale: orbScale }] },
                ]}
              />
            </View>
          </TouchableOpacity>

          <Text style={styles.stateTitle}>{stateTitle}</Text>
          <Text style={styles.stateSub}>{stateSub}</Text>
        </View>

        {/* ── Connection pill ─────────────────────────── */}
        <TouchableOpacity
          style={styles.pill}
          onPress={isConnected ? disconnect : isBusy ? undefined : connect}
          disabled={isBusy}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.pillDot,
              {
                backgroundColor: isConnected
                  ? c.statusConnected
                  : isBusy
                    ? c.statusScanning
                    : c.statusIdle,
              },
            ]}
          />
          <Text style={styles.pillText}>
            {isConnected
              ? 'Connected to your Haven — tap to disconnect'
              : isBusy
                ? 'Connecting…'
                : queuedCount > 0
                  ? `Not connected · ${queuedCount} change${queuedCount > 1 ? 's' : ''} waiting`
                  : 'Not connected — tap to connect'}
          </Text>
        </TouchableOpacity>

        {/* ── Quick cards ─────────────────────────────── */}
        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => onNavigate('tune')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardTitle}>Tune</Text>
            <Text style={styles.cardBody}>
              {bands.map(b => formatChip(b.f0)).join(' · ')}
            </Text>
            <Text style={styles.cardHint}>Shape which sounds are softened</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => onNavigate('hearing')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardTitle}>Hearing test</Text>
            <Text style={styles.cardBody}>5–10 minutes</Text>
            <Text style={styles.cardHint}>Find the sounds that hurt</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 32,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    wordmark: {
      fontFamily: SERIF_FONT,
      fontSize: 26,
      color: c.textPrimary,
      letterSpacing: 0.5,
    },
    themeToggle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.toggleBg,
      borderWidth: 1,
      borderColor: c.toggleBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleIcon: {
      fontSize: 16,
      color: c.textSecondary,
    },

    hero: {
      alignItems: 'center',
      marginTop: 46,
    },
    orbWrap: {
      width: 230,
      height: 230,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      position: 'absolute',
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor: c.accent,
      opacity: 0.55,
      // Soft halo: large radius shadow reads as glow on native; opacity fill on web.
      shadowColor: c.accent,
      shadowOpacity: 0.8,
      shadowRadius: 60,
      shadowOffset: { width: 0, height: 0 },
      transform: [{ scale: 0.92 }],
      ...(Platform.OS === 'web' ? { filter: 'blur(46px)' as unknown as undefined } : null),
    },
    ring: {
      position: 'absolute',
      width: 196,
      height: 196,
      borderRadius: 98,
      borderWidth: 1,
      borderColor: c.accent,
      opacity: 0.4,
    },
    ringMuted: {
      borderColor: c.border,
      opacity: 0.9,
    },
    orb: {
      width: 150,
      height: 150,
      borderRadius: 75,
    },
    orbActive: {
      backgroundColor: c.accent,
    },
    orbPaused: {
      backgroundColor: c.sliderDisabled,
    },
    orbOffline: {
      backgroundColor: c.sliderMax,
      borderWidth: 1,
      borderColor: c.border,
    },
    stateTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 32,
      color: c.textPrimary,
      marginTop: 30,
    },
    stateSub: {
      fontFamily: SANS_FONT,
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },

    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
      backgroundColor: c.cardBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 11,
      marginTop: 28,
    },
    pillDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    pillText: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      color: c.textSecondary,
    },

    cards: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 26,
    },
    card: {
      flex: 1,
      backgroundColor: c.cardBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS,
      padding: 18,
      minHeight: 118,
    },
    cardTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 18,
      color: c.textPrimary,
      marginBottom: 6,
    },
    cardBody: {
      fontFamily: SANS_FONT,
      fontSize: 13,
      color: c.accent,
      marginBottom: 6,
    },
    cardHint: {
      fontFamily: SANS_FONT,
      fontSize: 12,
      lineHeight: 17,
      color: c.textSecondary,
    },
  });
}
