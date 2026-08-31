import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterBand } from '../types';

const STORAGE_KEY = 'haven.filterProfile.v1';

export interface StoredFilterProfile {
  bands: FilterBand[];
  bypass: boolean;
}

export async function getFilterProfile(): Promise<StoredFilterProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.bands) || parsed.bands.length === 0) return null;
    return { bands: parsed.bands, bypass: Boolean(parsed.bypass) };
  } catch {
    // Corrupt or inaccessible storage just falls back to the default band.
    return null;
  }
}

export async function saveFilterProfile(profile: StoredFilterProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Best-effort: losing persistence shouldn't surface as a user-facing error.
  }
}
