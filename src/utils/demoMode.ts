import { Platform } from 'react-native';

/**
 * Demo mode (docs/demo-mode.md): web only, never on device. On when the
 * build was made with EXPO_PUBLIC_DEMO=1, or when a web visitor opens the
 * page with ?demo=1 — an explicit opt-in either way, so a normal build never
 * turns it on by itself.
 */
export function isDemoMode(): boolean {
  if (Platform.OS !== 'web') return false;
  if (process.env.EXPO_PUBLIC_DEMO === '1') return true;
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('demo') === '1';
  } catch {
    return false;
  }
}
