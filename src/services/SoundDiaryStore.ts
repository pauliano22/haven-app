import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaryFrame } from '../utils/soundFeatures';
import { DiaryMark } from '../utils/triggerAnalysis';
import { getConsent } from './ConsentStore';

const FRAMES_KEY = 'haven.soundDiary.frames.v1';
const MARKS_KEY = 'haven.soundDiary.marks.v1';

/**
 * Local sound diary: how loud each frequency band was, and when the person
 * tapped "that hurt" or "that was fine". Rules, same as ExposureLog:
 *  - nothing is written unless the user has agreed (ConsentStore);
 *  - audio is never stored, only band levels (see utils/soundFeatures);
 *  - it never leaves the phone;
 *  - it is a rolling window, not an archive.
 */

/** One frame per 5 s is 17,280 a day; keep about three days. */
export const DIARY_MAX_FRAMES = 52_000;
export const DIARY_MAX_MARKS = 2_000;

async function readJson<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export const getDiaryFrames = () => readJson<DiaryFrame>(FRAMES_KEY);
export const getDiaryMarks = () => readJson<DiaryMark>(MARKS_KEY);

export async function appendDiaryFrames(frames: DiaryFrame[]): Promise<void> {
  if (frames.length === 0 || (await getConsent()) === null) return;
  try {
    const existing = await getDiaryFrames();
    await AsyncStorage.setItem(FRAMES_KEY, JSON.stringify([...existing, ...frames].slice(-DIARY_MAX_FRAMES)));
  } catch {
    // Best-effort; losing a batch of frames only thins the diary.
  }
}

export async function addDiaryMark(mark: DiaryMark): Promise<boolean> {
  if ((await getConsent()) === null) return false;
  try {
    const existing = await getDiaryMarks();
    await AsyncStorage.setItem(MARKS_KEY, JSON.stringify([...existing, mark].slice(-DIARY_MAX_MARKS)));
    return true;
  } catch {
    return false;
  }
}

/** Remove the most recent tap, for "I tapped the wrong one". */
export async function undoLastDiaryMark(): Promise<void> {
  try {
    const existing = await getDiaryMarks();
    await AsyncStorage.setItem(MARKS_KEY, JSON.stringify(existing.slice(0, -1)));
  } catch {
    // Best-effort.
  }
}

export async function clearSoundDiary(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([FRAMES_KEY, MARKS_KEY]);
  } catch {
    // Best-effort.
  }
}
