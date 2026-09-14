import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPOSURE_LOG_MAX_EVENTS } from '../constants/outcomes';
import { ExposureEvent, ExposureEventType } from '../types';
import { getConsent } from './ConsentStore';

const STORAGE_KEY = 'haven.exposureLog.v1';

/**
 * Local, bounded log of what the device was doing: connections, the active
 * bands and depths, bypass state, and the check-ins. Without it none of the
 * outcome data is interpretable ("bother went down" means nothing if you
 * don't know whether softening was on). Rules:
 *  - nothing is written unless ConsentStore says the user agreed;
 *  - it never leaves the phone unless the user taps "Share my data";
 *  - it's a rolling window (EXPOSURE_LOG_MAX_EVENTS), not an archive.
 * Writes are fire-and-forget and coalesced by the caller (FilterContext
 * already debounces band changes).
 */

let consentCache: boolean | null = null;

/** Let ConsentScreen/withdrawal flip logging on or off without a reload. */
export function setConsentCache(consented: boolean): void {
  consentCache = consented;
}

async function consented(): Promise<boolean> {
  if (consentCache !== null) return consentCache;
  const record = await getConsent();
  consentCache = record !== null;
  return consentCache;
}

export async function getExposureLog(): Promise<ExposureEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function logExposure(
  type: ExposureEventType,
  data?: Record<string, unknown>,
  timestamp: number = Date.now(),
): Promise<void> {
  if (!(await consented())) return;
  try {
    const existing = await getExposureLog();
    const event: ExposureEvent = data ? { timestamp, type, data } : { timestamp, type };
    const next = [...existing, event].slice(-EXPOSURE_LOG_MAX_EVENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort.
  }
}

export async function clearExposureLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}
