import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThiRun, VasCheckIn } from '../types';

const VAS_KEY = 'haven.outcomes.vas.v1';
const THI_KEY = 'haven.outcomes.thi.v1';

/** Weekly for years still fits comfortably; bound it anyway. */
const MAX_VAS = 260;
const MAX_THI = 60;

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function prepend<T>(key: string, item: T, max: number): Promise<void> {
  try {
    const existing = await readList<T>(key);
    await AsyncStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, max)));
  } catch {
    // Best-effort, same as the other history stores.
  }
}

/** Newest first. */
export const getVasCheckIns = (): Promise<VasCheckIn[]> => readList<VasCheckIn>(VAS_KEY);
export const saveVasCheckIn = (v: VasCheckIn): Promise<void> => prepend(VAS_KEY, v, MAX_VAS);

/** Newest first. */
export const getThiRuns = (): Promise<ThiRun[]> => readList<ThiRun>(THI_KEY);
export const saveThiRun = (t: ThiRun): Promise<void> => prepend(THI_KEY, t, MAX_THI);
