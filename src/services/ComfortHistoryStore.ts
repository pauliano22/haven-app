import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComfortDirection } from '../components/ComfortCheckIn';

const STORAGE_KEY = 'haven.comfortHistory.v1';

/** Keep storage bounded -- this is a rolling recent-history view, not an
 * archive, same convention as LdlHistoryStore/MatchHistoryStore. */
const MAX_STORED_RESPONSES = 20;

export interface ComfortResponse {
  timestamp: number;
  direction: ComfortDirection;
}

export async function getComfortHistory(): Promise<ComfortResponse[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveComfortResponse(response: ComfortResponse): Promise<void> {
  try {
    const existing = await getComfortHistory();
    const updated = [response, ...existing].slice(0, MAX_STORED_RESPONSES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Best-effort, same as every other history store here: losing this
    // only means the tolerance-pacing heuristic falls back to the fixed
    // interval, never a user-facing error.
  }
}
