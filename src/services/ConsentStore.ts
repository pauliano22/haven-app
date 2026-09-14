import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONSENT_VERSION } from '../constants/outcomes';
import { ConsentRecord } from '../types';

const STORAGE_KEY = 'haven.consent.v1';

/**
 * Whether the user has agreed to local logging (docs/safety.md, "Your
 * data"). Consent is per wording version: a materially changed notice asks
 * again. Nothing is logged by ExposureLog until this returns a record.
 */
export async function getConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.acceptedAt !== 'number') return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
}

export async function saveConsent(record: ConsentRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort; the user will simply be asked again.
  }
}

/** Withdraw: clears consent AND is the caller's cue to clear the exposure log. */
export async function clearConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}
