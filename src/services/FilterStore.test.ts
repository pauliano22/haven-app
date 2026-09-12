import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterBand } from '../types';
import { getFilterProfile, saveFilterProfile } from './FilterStore';

const band: FilterBand = { id: '1', f0: 4500, q: 10, attenDb: 20 };

describe('FilterStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when nothing has been saved yet', async () => {
    expect(await getFilterProfile()).toBeNull();
  });

  it('round-trips a saved profile', async () => {
    await saveFilterProfile({ bands: [band], bypass: true });
    expect(await getFilterProfile()).toEqual({ bands: [band], bypass: true });
  });

  it('treats an empty band list as no saved profile', async () => {
    await saveFilterProfile({ bands: [], bypass: false });
    expect(await getFilterProfile()).toBeNull();
  });

  it('falls back to null on corrupt storage instead of throwing', async () => {
    await AsyncStorage.setItem('haven.filterProfile.v1', '{not valid json');
    await expect(getFilterProfile()).resolves.toBeNull();
  });

  it('coerces a missing/undefined bypass flag to false', async () => {
    await AsyncStorage.setItem('haven.filterProfile.v1', JSON.stringify({ bands: [band] }));
    expect(await getFilterProfile()).toEqual({ bands: [band], bypass: false });
  });
});
