import { dirname, join } from 'node:path';
import {
  CreateQuoteRequest,
  GetSiteContent,
  LookupPincode,
  PurgeExpiredData,
  RecordConsent,
  ResolveArea,
  SubmitContactRequest,
  TrackVisit,
  type AreaGeocoder,
  type CaptchaVerifier,
  type ConsentRepository,
  type ContactRequestRepository,
  type Logger,
  type PincodeDirectory,
  type QuoteRepository,
  type VisitorAnalyticsRepository,
} from '@rs/application';
import {
  CryptoIdGenerator,
  ExcelConsentRepository,
  ExcelContactRequestRepository,
  ExcelQuoteRepository,
  ExcelVisitorAnalyticsRepository,
  InMemoryIdempotencyStore,
  IndiaPostPincodeDirectory,
  NoCaptchaVerifier,
  OfflineAreaGeocoder,
  OfflinePincodeDirectory,
  OpenAreaGeocoder,
  StaticContentRepository,
  SystemClock,
  TurnstileCaptchaVerifier,
} from '@rs/infrastructure';
import type { AppEnv } from './config/env';

export interface Container {
  env: AppEnv;
  repositories: {
    quotes: QuoteRepository;
    contacts: ContactRequestRepository;
    consents: ConsentRepository;
    visitors: VisitorAnalyticsRepository;
  };
  captcha: CaptchaVerifier;
  useCases: {
    createQuote: CreateQuoteRequest;
    submitContact: SubmitContactRequest;
    recordConsent: RecordConsent;
    trackVisit: TrackVisit;
    getContent: GetSiteContent;
    lookupPincode: LookupPincode;
    resolveArea: ResolveArea;
    purgeExpired: PurgeExpiredData;
  };
}

/** Optional adapter overrides (used by tests to avoid the network). */
export interface ContainerAdapters {
  pincodeDirectory?: PincodeDirectory;
  areaGeocoder?: AreaGeocoder;
}

/** Composition root: the only place where concrete adapters are chosen. */
export function createContainer(
  env: AppEnv,
  logger: Logger,
  adapters: ContainerAdapters = {},
): Container {
  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const idempotency = new InMemoryIdempotencyStore();

  const backup = (filePath: string) => ({
    filePath,
    backupDir: join(dirname(filePath), 'backups'),
    backupsToKeep: env.XLSX_BACKUPS_TO_KEEP,
    backupMinIntervalMs: env.XLSX_BACKUP_MIN_INTERVAL_MINUTES * 60_000,
    logger,
  });

  const quotes = new ExcelQuoteRepository(backup(env.QUOTES_XLSX_PATH));
  const contacts = new ExcelContactRequestRepository(backup(env.CONTACTS_XLSX_PATH));
  const consents = new ExcelConsentRepository(backup(env.CONSENTS_XLSX_PATH));
  const visitors = new ExcelVisitorAnalyticsRepository(backup(env.VISITORS_XLSX_PATH));

  const captcha: CaptchaVerifier =
    env.CAPTCHA_PROVIDER === 'turnstile' && env.CAPTCHA_SECRET_KEY
      ? new TurnstileCaptchaVerifier(env.CAPTCHA_SECRET_KEY)
      : new NoCaptchaVerifier();

  // Nominatim/Photon policies ask for an identifying User-Agent.
  const userAgent = `${env.BUSINESS_NAME.replace(/[^\w .&-]/g, '')} website (${env.PUBLIC_SITE_URL})`;
  const offline = env.LOCATION_LOOKUP === 'offline';
  const pincodeDirectory =
    adapters.pincodeDirectory ??
    (offline ? new OfflinePincodeDirectory() : new IndiaPostPincodeDirectory());
  const areaGeocoder =
    adapters.areaGeocoder ??
    (offline ? new OfflineAreaGeocoder() : new OpenAreaGeocoder(userAgent));

  return {
    env,
    repositories: { quotes, contacts, consents, visitors },
    captcha,
    useCases: {
      createQuote: new CreateQuoteRequest({
        quotes,
        consents,
        clock,
        ids,
        captcha,
        idempotency,
        logger,
        businessName: env.BUSINESS_NAME,
        whatsappNumber: env.WHATSAPP_NUMBER,
      }),
      submitContact: new SubmitContactRequest({
        contacts,
        consents,
        clock,
        ids,
        captcha,
        idempotency,
        logger,
      }),
      recordConsent: new RecordConsent({ consents, clock, ids, logger }),
      trackVisit: new TrackVisit({ visitors, clock }),
      getContent: new GetSiteContent(new StaticContentRepository()),
      lookupPincode: new LookupPincode(pincodeDirectory),
      resolveArea: new ResolveArea(areaGeocoder),
      purgeExpired: new PurgeExpiredData({
        quotes,
        contacts,
        consents,
        visitors,
        clock,
        logger,
        retentionDays: env.DATA_RETENTION_DAYS,
      }),
    },
  };
}
