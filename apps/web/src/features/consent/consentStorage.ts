import { CONSENT_VERSION, PRIVACY_NOTICE_VERSION, consentPreferencesSchema } from '@rs/shared';
import { z } from 'zod';

export const CONSENT_STORAGE_KEY = 'rs_consent_v1';

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'location';

export interface ConsentChoices {
  analytics: boolean;
  marketing: boolean;
  location: boolean;
}

export interface ConsentDecision extends ConsentChoices {
  consentVersion: string;
  privacyNoticeVersion: string;
  decidedAt: string;
}

const storedSchema = consentPreferencesSchema.extend({ decidedAt: z.string().min(1).max(40) });

/**
 * Parses the stored decision. Returns null when it is missing, malformed, or was made
 * for an older consent version (so the banner is shown again).
 */
export function parseStoredConsent(
  raw: string | null | undefined,
  currentVersion: string = CONSENT_VERSION,
): ConsentDecision | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = storedSchema.safeParse(json);
  if (!parsed.success) return null;
  if (parsed.data.consentVersion !== currentVersion) return null;
  const { analytics, marketing, location, consentVersion, privacyNoticeVersion, decidedAt } =
    parsed.data;
  return { analytics, marketing, location, consentVersion, privacyNoticeVersion, decidedAt };
}

export function buildDecision(choices: ConsentChoices, now: Date = new Date()): ConsentDecision {
  return {
    analytics: choices.analytics,
    marketing: choices.marketing,
    location: choices.location,
    consentVersion: CONSENT_VERSION,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    decidedAt: now.toISOString(),
  };
}

export function readStoredConsent(): ConsentDecision | null {
  try {
    return parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredConsent(decision: ConsentDecision): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(decision));
  } catch {
    // Storage can be blocked; the decision then only lasts for this page view.
  }
}
