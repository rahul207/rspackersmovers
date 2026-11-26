import {
  CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  type ContactCreated,
  type ContactRequestPayload,
} from '@rs/shared';
import {
  DuplicateReferenceError,
  buildReference,
  createContactRequest,
  createPurposeConsent,
  toIstDate,
} from '@rs/domain';
import type { ConsentRepository } from '../consent/ports';
import {
  enforceBotProtection,
  type CaptchaVerifier,
  type Clock,
  type IdGenerator,
  type IdempotencyStore,
  type Logger,
} from '../shared-kernel/ports';
import type { ContactRequestRepository } from './ports';

export interface SubmitContactDeps {
  contacts: ContactRequestRepository;
  consents: ConsentRepository;
  clock: Clock;
  ids: IdGenerator;
  captcha: CaptchaVerifier;
  idempotency: IdempotencyStore;
  logger: Logger;
}

const MAX_ATTEMPTS = 8;

export class SubmitContactRequest {
  constructor(private readonly deps: SubmitContactDeps) {}

  async execute(
    payload: ContactRequestPayload,
    context: { visitorId?: string | undefined } = {},
  ): Promise<ContactCreated> {
    await enforceBotProtection(payload, this.deps.captcha);
    const key = ['contact', payload.mobile, payload.subject.toLowerCase(), payload.message].join(
      '|',
    );
    return this.deps.idempotency.run(key, () => this.create(payload, context.visitorId));
  }

  private async create(
    payload: ContactRequestPayload,
    visitorId: string | undefined,
  ): Promise<ContactCreated> {
    const { clock, ids, contacts, consents, logger } = this.deps;
    const now = clock.now();
    const consent = createPurposeConsent({
      consentId: ids.uuid(),
      timestamp: now,
      visitorId: visitorId ?? '',
      purpose: 'CONTACT',
      consentVersion: CONSENT_VERSION,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const request = createContactRequest({
        requestId: buildReference('RSPM-C', toIstDate(now), (n) => ids.randomInt(n)),
        createdAt: now,
        name: payload.name,
        mobile: payload.mobile,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
        preferredContactMethod: payload.preferredContactMethod,
        consentReference: consent.consentId,
        sourcePage: payload.sourcePage,
      });
      try {
        if (attempt === 1) await consents.save(consent);
        await contacts.save(request);
      } catch (error) {
        if (error instanceof DuplicateReferenceError) continue;
        throw error;
      }
      logger.info('contact.created', { requestId: request.requestId });
      return { requestId: request.requestId, createdAt: now.toISOString() };
    }
    throw new Error('Could not allocate a unique contact request ID');
  }
}
