import type { ConsentPreferencesPayload, ConsentRecorded } from '@rs/shared';
import type { ConsentRecord } from '@rs/domain';
import type { Clock, IdGenerator, Logger } from '../shared-kernel/ports';
import type { ConsentRepository } from './ports';

export class RecordConsent {
  constructor(
    private readonly deps: {
      consents: ConsentRepository;
      clock: Clock;
      ids: IdGenerator;
      logger: Logger;
    },
  ) {}

  /** Records a cookie-preference decision. Returns the record and the (possibly new) visitor ID. */
  async execute(
    prefs: ConsentPreferencesPayload,
    context: { visitorId?: string | undefined },
  ): Promise<{ result: ConsentRecorded; visitorId: string; record: ConsentRecord }> {
    const visitorId = context.visitorId ?? this.deps.ids.uuid();
    const record: ConsentRecord = {
      consentId: this.deps.ids.uuid(),
      timestamp: this.deps.clock.now(),
      visitorId,
      purpose: 'COOKIE_PREFERENCES',
      consentVersion: prefs.consentVersion,
      privacyNoticeVersion: prefs.privacyNoticeVersion,
      necessary: true,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      location: prefs.location,
    };
    await this.deps.consents.save(record);
    this.deps.logger.info('consent.recorded', {
      analytics: record.analytics,
      marketing: record.marketing,
      location: record.location,
    });
    return {
      visitorId,
      record,
      result: {
        consentId: record.consentId,
        analytics: record.analytics,
        marketing: record.marketing,
        location: record.location,
      },
    };
  }
}
