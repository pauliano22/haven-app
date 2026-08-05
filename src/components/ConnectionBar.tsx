import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { ColorPalette, MONO_FONT, RADIUS, RADIUS_SM } from '../constants/theme';
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

  const styles = useMemo(() => makeStyles(c), [c]);
  const { label, color } = statusConfig(status, c);
  const isBusy = status === 'scanning' || status === 'connecting';
  const isReconnecting = status === 'reconnecting';
  const isConnected = status === 'connected';
  const showTeardown = isConnected || isReconnecting;

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {isBusy || isReconnecting ? (
          <ActivityIndicator size="small" color={color} style={styles.dot} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
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
    // Square status LED, like a panel indicator
    dot: {
      width: 8,
      height: 8,
      borderRadius: 1,
    },
    statusLabel: {
      fontSize: 12,
      fontFamily: MONO_FONT,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    queuedLabel: {
      fontSize: 10,
      fontFamily: MONO_FONT,
      color: c.textSecondary,
      letterSpacing: 0.5,
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
      fontSize: 12,
      fontFamily: MONO_FONT,
      fontWeight: '700',
      color: c.btnConnectText,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    buttonTextDisconnect: {
      color: c.btnDisconnectBorder,
    },
  });
}
