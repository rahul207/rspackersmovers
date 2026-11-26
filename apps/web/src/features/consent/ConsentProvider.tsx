import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ConsentPreferencesPayload } from '@rs/shared';
import { apiPost } from '../../lib/apiClient';
import {
  buildDecision,
  readStoredConsent,
  writeStoredConsent,
  type ConsentCategory,
  type ConsentChoices,
  type ConsentDecision,
} from './consentStorage';
import { ConsentContext, type ConsentContextValue } from './consentContext';

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<ConsentDecision | null>(() => readStoredConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const saveChoices = useCallback((choices: ConsentChoices) => {
    const next = buildDecision(choices);
    writeStoredConsent(next);
    setDecision(next);
    setPreferencesOpen(false);
    const payload: ConsentPreferencesPayload = {
      analytics: next.analytics,
      marketing: next.marketing,
      location: next.location,
      consentVersion: next.consentVersion,
      privacyNoticeVersion: next.privacyNoticeVersion,
    };
    // Recording on the server must never block the UI.
    apiPost('/consents', payload).catch(() => undefined);
  }, []);

  const allows = useCallback(
    (category: ConsentCategory) => {
      if (category === 'necessary') return true;
      return decision ? decision[category] : false;
    },
    [decision],
  );

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      decision,
      hasDecided: decision !== null,
      allows,
      openPreferences,
      closePreferences,
      preferencesOpen,
      saveChoices,
    }),
    [decision, allows, openPreferences, closePreferences, preferencesOpen, saveChoices],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
