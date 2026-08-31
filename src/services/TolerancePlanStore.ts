import AsyncStorage from '@react-native-async-storage/async-storage';
import { TolerancePlan } from '../types';

const STORAGE_KEY = 'haven.tolerancePlan.v1';

/** Null means no active plan -- distinct from "not loaded yet". */
export async function getTolerancePlan(): Promise<TolerancePlan | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.bandId !== 'string') return null;
    return parsed as TolerancePlan;
  } catch {
    return null;
  }
}

/** Pass null to clear (stopping the plan). */
export async function saveTolerancePlan(plan: TolerancePlan | null): Promise<void> {
  try {
    if (plan === null) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    }
  } catch {
    // Best-effort: worst case the plan's timing/step count drifts slightly.
  }
}
