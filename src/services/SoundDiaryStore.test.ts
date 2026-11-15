import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveConsent } from './ConsentStore';
import { CONSENT_VERSION } from '../constants/outcomes';
import {
  addDiaryMark,
  appendDiaryFrames,
  clearSoundDiary,
  getDiaryFrames,
  getDiaryMarks,
  undoLastDiaryMark,
} from './SoundDiaryStore';

const frame = (t: number) => ({ timestamp: t, bands: [-50, -50, -50, -50, -50, -50, -50], overallDb: -40 });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('SoundDiaryStore', () => {
  it('stores nothing until the user has agreed', async () => {
    await appendDiaryFrames([frame(1)]);
    expect(await addDiaryMark({ timestamp: 2, kind: 'hurt' })).toBe(false);
    expect(await getDiaryFrames()).toEqual([]);
    expect(await getDiaryMarks()).toEqual([]);
  });

  it('stores frames and marks after consent, and can undo the last mark', async () => {
    await saveConsent({ acceptedAt: 1, version: CONSENT_VERSION });
    await appendDiaryFrames([frame(1), frame(2)]);
    await addDiaryMark({ timestamp: 3, kind: 'hurt' });
    await addDiaryMark({ timestamp: 4, kind: 'fine' });
    expect(await getDiaryFrames()).toHaveLength(2);
    await undoLastDiaryMark();
    expect(await getDiaryMarks()).toEqual([{ timestamp: 3, kind: 'hurt' }]);
  });

  it('clears everything', async () => {
    await saveConsent({ acceptedAt: 1, version: CONSENT_VERSION });
    await appendDiaryFrames([frame(1)]);
    await addDiaryMark({ timestamp: 2, kind: 'fine' });
    await clearSoundDiary();
    expect(await getDiaryFrames()).toEqual([]);
    expect(await getDiaryMarks()).toEqual([]);
  });

  it('survives corrupted storage', async () => {
    await AsyncStorage.setItem('haven.soundDiary.frames.v1', '{not json');
    expect(await getDiaryFrames()).toEqual([]);
  });
});
