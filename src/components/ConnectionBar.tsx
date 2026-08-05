import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { ColorPalette, RADIUS, RADIUS_SM, SANS_FONT } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ConnectionStatus } from '../types';

function statusConfig(
  status: ConnectionStatus,
  c: ColorPalette,
): { label: string; color: string } {
  return {
    idle:         { label: 'Disconnected',    color: c.statusIdle },
    scanning:     { label: 'Scanning...',     color: c.statusScanning },
    connecting:   { label: 'Connecting...',   color: c.statusScanning },
    connected:    { label: 'Connected',       color: c.statusConnected },
    reconnecting: { label: 'Reconnecting...', color: c.statusScanning },
    disconnected: { label: 'Disconnected',    color: c.statusDisconnected },
  }[status];
}

export function ConnectionBar() {
  const { status, queuedCount, connect, disconnect } = useBle();
  const { theme } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReducedMotion();

  const styles = useMemo(() => makeStyles(c), [c]);
  const { label, color } = statusConfig(status, c);
  const isBusy = status === 'scanning' || status === 'connecting';
  const isReconnecting = status === 'reconnecting';
  const isConnected = status === 'connected';
  const showTeardown = isConnected || isReconnecting;

  // Connected LED breathes slowly — a calm heartbeat, not an alert.
  const ledOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConnected || reduceMotion) {
      ledOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ledOpacity, {
          toValue: 0.45,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ledOpacity, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isConnected, reduceMotion, ledOpacity]);

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {isBusy || isReconnecting ? (
          <ActivityIndicator size="small" color={color} style={styles.dot} />
        ) : (
          <Animated.View
            style={[styles.dot, { backgroundColor: color, opacity: ledOpacity }]}
          />
        )}
        <Text style={[styles.statusLabel, { color }]}>{label}</Text>
        {queuedCount > 0 && !isConnected && (
          <Text style={styles.queuedLabel}>
            {queuedCount} queued
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, showTeardown ? styles.buttonDisconnect : styles.buttonConnect]}
        onPress={showTeardown ? disconnect : connect}
        disabled={isBusy}
        activeOpacity={0.75}
      >
        <Text style={[styles.buttonText, showTeardown && styles.buttonTextDisconnect]}>
          {isConnected
            ? 'Disconnect'
            : isReconnecting
              ? 'Cancel'
              : isBusy
                ? 'Scanning...'
                : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.cardBg,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 13,
      marginBottom: 16,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusLabel: {
      fontSize: 13,
      fontFamily: SANS_FONT,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    queuedLabel: {
      fontSize: 11,
      fontFamily: SANS_FONT,
      color: c.textSecondary,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: RADIUS_SM,
    },
    buttonConnect: {
      backgroundColor: c.btnConnectBg,
    },
    buttonDisconnect: {
      backgroundColor: c.btnDisconnectBg,
      borderWidth: 1,
      borderColor: c.btnDisconnectBorder,
    },
    buttonText: {
      fontSize: 13,
      fontFamily: SANS_FONT,
      fontWeight: '700',
      color: c.btnConnectText,
      letterSpacing: 0.2,
    },
    buttonTextDisconnect: {
      color: c.btnDisconnectBorder,
    },
  });
}
