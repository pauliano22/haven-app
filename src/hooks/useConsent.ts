import { useCallback, useEffect, useState } from 'react';
import { CONSENT_VERSION } from '../constants/outcomes';
import { clearConsent, getConsent, saveConsent } from '../services/ConsentStore';
import { clearExposureLog, setConsentCache } from '../services/ExposureLog';

/**
 * Local-logging consent. `accept` turns the exposure log on; `withdraw`
 * turns it off AND deletes what was logged — withdrawing consent to
 * collection without deleting the collection would be a hollow gesture.
 */
export function useConsent() {
  const [consented, setConsented] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getConsent().then((record) => {
      const ok = record !== null;
      setConsented(ok);
      setConsentCache(ok);
      setLoaded(true);
    });
  }, []);

  const accept = useCallback(() => {
    setConsented(true);
    setConsentCache(true);
    saveConsent({ acceptedAt: Date.now(), version: CONSENT_VERSION });
  }, []);

  const withdraw = useCallback(async () => {
    setConsented(false);
    setConsentCache(false);
    await clearConsent();
    await clearExposureLog();
  }, []);

  return { consented, loaded, accept, withdraw };
}
