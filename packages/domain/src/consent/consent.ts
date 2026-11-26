import type { ConsentPurpose } from '@rs/shared';

export interface ConsentPreferences {
  /** Strictly necessary cookies are always on. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  location: boolean;
}

export interface ConsentRecord extends ConsentPreferences {
  consentId: string;
  timestamp: Date;
  /** Anonymous visitor ID; empty when no visitor cookie exists. */
  visitorId: string;
  purpose: ConsentPurpose;
  consentVersion: string;
  privacyNoticeVersion: string;
}

/** Optional categories are never pre-selected. */
export const REJECT_ALL: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  location: false,
};

export function canRecordAnalytics(
  prefs: Pick<ConsentPreferences, 'analytics'> | undefined,
): boolean {
  return prefs?.analytics === true;
}

/** Consent given for quotation or contact never grants any optional cookie category. */
export function createPurposeConsent(
  props: Pick<
    ConsentRecord,
    'consentId' | 'timestamp' | 'visitorId' | 'purpose' | 'consentVersion' | 'privacyNoticeVersion'
  >,
): ConsentRecord {
  return { ...props, ...REJECT_ALL };
}
