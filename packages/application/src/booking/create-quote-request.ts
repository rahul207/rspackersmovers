import {
  CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  type QuoteCreated,
  type QuoteRequestPayload,
} from '@rs/shared';
import {
  DuplicateReferenceError,
  buildQuoteWhatsAppMessage,
  buildReference,
  buildWhatsAppUrl,
  createPurposeConsent,
  createQuoteRequest,
  estimateDistanceKm,
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
import type { QuoteRepository } from './ports';

export interface CreateQuoteDeps {
  quotes: QuoteRepository;
  consents: ConsentRepository;
  clock: Clock;
  ids: IdGenerator;
  captcha: CaptchaVerifier;
  idempotency: IdempotencyStore;
  logger: Logger;
  businessName: string;
  /** Complete international WhatsApp number; when absent no redirect URL is produced. */
  whatsappNumber?: string | undefined;
}

const MAX_REFERENCE_ATTEMPTS = 8;

const norm = (s: string) => s.trim().toLowerCase();

export class CreateQuoteRequest {
  constructor(private readonly deps: CreateQuoteDeps) {}

  async execute(
    payload: QuoteRequestPayload,
    context: { visitorId?: string | undefined } = {},
  ): Promise<QuoteCreated> {
    await enforceBotProtection(payload, this.deps.captcha);
    // Same customer, addresses, date and vehicle submitted twice (double click, retry) -> one quote.
    const key = [
      'quote',
      payload.mobile,
      payload.pickup.pincode,
      norm(payload.pickup.streetAddress),
      payload.drop.pincode,
      norm(payload.drop.streetAddress),
      payload.pickupDate,
      payload.moveType,
      payload.vehicleType,
    ].join('|');
    return this.deps.idempotency.run(key, () => this.create(payload, context.visitorId));
  }

  private async create(
    payload: QuoteRequestPayload,
    visitorId: string | undefined,
  ): Promise<QuoteCreated> {
    const { clock, ids, quotes, consents, logger } = this.deps;
    const now = clock.now();
    const todayIst = toIstDate(now);
    const distanceKm = estimateDistanceKm(payload.pickup, payload.drop);

    const consent = createPurposeConsent({
      consentId: ids.uuid(),
      timestamp: now,
      visitorId: visitorId ?? '',
      purpose: 'QUOTATION',
      consentVersion: CONSENT_VERSION,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    });

    for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt++) {
      const quote = createQuoteRequest(
        {
          referenceNumber: buildReference('RSPM', todayIst, (n) => ids.randomInt(n)),
          createdAt: now,
          customerName: payload.customerName,
          mobile: payload.mobile,
          email: payload.email,
          pickup: payload.pickup,
          drop: payload.drop,
          distanceKm,
          moveType: payload.moveType,
          vehicleType: payload.vehicleType,
          pickupDate: payload.pickupDate,
          notes: payload.notes,
          consentReference: consent.consentId,
          sourcePage: payload.sourcePage,
        },
        todayIst,
      );
      try {
        if (attempt === 1) await consents.save(consent);
        await quotes.save(quote);
      } catch (error) {
        if (error instanceof DuplicateReferenceError) continue;
        throw error;
      }

      const message = buildQuoteWhatsAppMessage(quote, this.deps.businessName);
      const url = this.deps.whatsappNumber
        ? buildWhatsAppUrl(this.deps.whatsappNumber, message)
        : null;
      logger.info('quote.created', { referenceNumber: quote.referenceNumber });
      return {
        referenceNumber: quote.referenceNumber,
        createdAt: now.toISOString(),
        whatsapp: { ...(url ? { url } : {}), message },
      };
    }
    throw new Error('Could not allocate a unique quote reference');
  }
}
