import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { ConnectionStatus } from '../types';

function statusConfig(
  status: ConnectionStatus,
  c: ColorPalette,
): { label: string; color: string } {
  return {
    idle:         { label: 'Disconnected',  color: c.statusIdle },
    scanning:     { label: 'Scanning...',   color: c.statusScanning },
    connecting:   { label: 'Connecting...', color: c.statusScanning },
    connected:    { label: 'Connected',     color: c.statusConnected },
    disconnected: { label: 'Disconnected',  color: c.statusDisconnected },
  }[status];
}

export function ConnectionBar() {
  const { status, connect, disconnect } = useBle();
  const { theme } = useTheme();
  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);
  const { label, color } = statusConfig(status, c);
  const isScanning = status === 'scanning' || status === 'connecting';
  const isConnected = status === 'connected';

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {isScanning ? (
          <ActivityIndicator size="small" color={color} style={styles.dot} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isConnected ? styles.buttonDisconnect : styles.buttonConnect]}
        onPress={isConnected ? disconnect : connect}
        disabled={isScanning}
        activeOpacity={0.75}
      >
        <Text style={[styles.buttonText, isConnected && styles.buttonTextDisconnect]}>
          {isConnected ? 'Disconnect' : isScanning ? 'Scanning...' : 'Connect'}
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
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 20,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusLabel: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    button: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 8,
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
      fontWeight: '700',
      color: c.btnConnectText,
      letterSpacing: 0.5,
    },
    buttonTextDisconnect: {
      color: c.btnDisconnectBorder,
    },
  });
}
