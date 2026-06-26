import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBle } from '../context/BleContext';
import { ConnectionStatus } from '../types';

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  idle:         { label: 'Disconnected',  color: '#6B7FA3' },
  scanning:     { label: 'Scanning...',   color: '#FFB347' },
  connecting:   { label: 'Connecting...', color: '#FFB347' },
  connected:    { label: 'Connected',     color: '#00E5CC' },
  disconnected: { label: 'Disconnected',  color: '#FF4D6D' },
};

export function ConnectionBar() {
  const { status, connect, disconnect } = useBle();
  const { label, color } = STATUS_CONFIG[status];
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
        <Text style={styles.buttonText}>
          {isConnected ? 'Disconnect' : isScanning ? 'Scanning...' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1628',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A2744',
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
    backgroundColor: '#00E5CC',
  },
  buttonDisconnect: {
    backgroundColor: '#1A2744',
    borderWidth: 1,
    borderColor: '#FF4D6D',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#060B14',
    letterSpacing: 0.5,
  },
});
