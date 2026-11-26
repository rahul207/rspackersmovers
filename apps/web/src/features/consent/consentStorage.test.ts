import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from '@rs/shared';
import { buildDecision, parseStoredConsent } from './consentStorage';

describe('consent storage', () => {
  it('round-trips a decision made for the current version', () => {
    const decision = buildDecision({ analytics: true, marketing: false, location: false });
    expect(decision.consentVersion).toBe(CONSENT_VERSION);
    expect(decision.privacyNoticeVersion).toBe(PRIVACY_NOTICE_VERSION);
    expect(parseStoredConsent(JSON.stringify(decision))).toEqual(decision);
  });

  it('treats missing, malformed or incomplete values as undecided', () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent('not json')).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ analytics: true }))).toBeNull();
    expect(
      parseStoredConsent(
        JSON.stringify({
          analytics: 'yes',
          marketing: false,
          location: false,
          consentVersion: CONSENT_VERSION,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          decidedAt: new Date().toISOString(),
        }),
      ),
    ).toBeNull();
  });

  it('asks again when the consent version has changed', () => {
    const old = {
      ...buildDecision({ analytics: true, marketing: true, location: true }),
      consentVersion: '2020-01',
    };
    expect(parseStoredConsent(JSON.stringify(old))).toBeNull();
  });
});
