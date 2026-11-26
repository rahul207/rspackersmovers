import { createContext, useContext } from 'react';
import type { ConsentCategory, ConsentChoices, ConsentDecision } from './consentStorage';

export interface ConsentContextValue {
  decision: ConsentDecision | null;
  hasDecided: boolean;
  allows: (category: ConsentCategory) => boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  preferencesOpen: boolean;
  saveChoices: (choices: ConsentChoices) => void;
}

export const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside ConsentProvider');
  return value;
}
