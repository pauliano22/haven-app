import AsyncStorage from '@react-native-async-storage/async-storage';
import { Nof1Trial } from '../types';

const STORAGE_KEY = 'haven.nof1Trial.v1';

/** Null means no trial (never started, or cleared) -- distinct from "not loaded yet". */
export async function getTrial(): Promise<Nof1Trial | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.startDay !== 'string' || !Array.isArray(parsed.schedule)) return null;
    return {
      ...parsed,
      ratings: parsed.ratings ?? {},
      overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [],
      stoppedAt: parsed.stoppedAt ?? null,
    } as Nof1Trial;
  } catch {
    return null;
  }
}

/** Pass null to clear. */
export async function saveTrial(trial: Nof1Trial | null): Promise<void> {
  try {
    if (trial === null) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trial));
  } catch {
    // Best-effort.
  }
}
