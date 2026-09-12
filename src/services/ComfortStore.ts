import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'haven.comfortPrompt.v1';

export async function getLastPromptedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setLastPromptedAt(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(timestamp));
  } catch {
    // Best-effort: worst case the prompt just asks again sooner than intended.
  }
}
