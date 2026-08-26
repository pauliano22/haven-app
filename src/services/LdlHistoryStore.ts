import AsyncStorage from '@react-native-async-storage/async-storage';
import { LdlRun } from '../types';

const STORAGE_KEY = 'haven.ldlHistory.v1';

/** Keep storage bounded -- this is a rolling recent-history view, not an archive. */
const MAX_STORED_RUNS = 20;

export async function getLdlHistory(): Promise<LdlRun[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or inaccessible storage shouldn't block the test flow.
    return [];
  }
}

export async function saveLdlRun(run: LdlRun): Promise<void> {
  try {
    const existing = await getLdlHistory();
    const updated = [run, ...existing].slice(0, MAX_STORED_RUNS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Best-effort: losing history persistence shouldn't surface as a user-facing error.
  }
}
