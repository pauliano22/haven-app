import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONSENT_VERSION } from '../constants/outcomes';
import { clearConsent, getConsent, saveConsent } from './ConsentStore';
import { clearExposureLog, getExposureLog, logExposure, setConsentCache } from './ExposureLog';

describe('ExposureLog + consent gate', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setConsentCache(false);
  });

  it('writes nothing without consent', async () => {
    await logExposure('connected');
    expect(await getExposureLog()).toEqual([]);
  });

  it('logs once consent is recorded, newest last, with optional data', async () => {
    await saveConsent({ acceptedAt: 1, version: CONSENT_VERSION });
    setConsentCache(true);
    await logExposure('connected', undefined, 100);
    await logExposure('bands', { bands: [{ f0: 4500, atten: 20 }] }, 200);
    const log = await getExposureLog();
    expect(log.map((e) => e.type)).toEqual(['connected', 'bands']);
    expect(log[1].data).toEqual({ bands: [{ f0: 4500, atten: 20 }] });
    expect(log[0]).not.toHaveProperty('data');
  });

  it('withdrawing consent clears the record and the log can be wiped', async () => {
    await saveConsent({ acceptedAt: 1, version: CONSENT_VERSION });
    setConsentCache(true);
    await logExposure('bypass', { enabled: true });
    await clearConsent();
    await clearExposureLog();
    expect(await getConsent()).toBeNull();
    expect(await getExposureLog()).toEqual([]);
  });

  it('a consent record from an older wording version does not count', async () => {
    await saveConsent({ acceptedAt: 1, version: CONSENT_VERSION - 1 });
    expect(await getConsent()).toBeNull();
  });
});
