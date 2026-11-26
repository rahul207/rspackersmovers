import { describe, expect, it } from 'vitest';
import { quoteRequestSchema, type PostOfficeEntry, type ResolvedArea } from '@rs/shared';
import { DuplicateReferenceError, type ConsentRecord, type QuoteRequest } from '@rs/domain';
import {
  ApplicationError,
  CreateQuoteRequest,
  LookupPincode,
  PurgeExpiredData,
  ResolveArea,
  TrackVisit,
  type AreaGeocoder,
  type CaptchaVerifier,
  type IdempotencyStore,
  type Logger,
  type PincodeDirectory,
  type QuoteRepository,
} from '../src';

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const now = new Date('2026-11-26T06:00:00Z');
const clock = { now: () => now };

class MemoryIdempotency implements IdempotencyStore {
  readonly map = new Map<string, Promise<unknown>>();
  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (!this.map.has(key)) this.map.set(key, work());
    return this.map.get(key) as Promise<T>;
  }
}

function ids(sequence: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  let i = 0;
  let u = 0;
  return {
    uuid: () => `00000000-0000-4000-8000-${String(++u).padStart(12, '0')}`,
    randomInt: () => sequence[i++ % sequence.length]!,
  };
}

const okCaptcha: CaptchaVerifier = { provider: 'none', verify: () => Promise.resolve(true) };
const badCaptcha: CaptchaVerifier = { provider: 'turnstile', verify: () => Promise.resolve(false) };

const payload = quoteRequestSchema.parse({
  pickup: {
    pincode: '400053',
    area: 'Andheri West',
    district: 'Mumbai',
    state: 'Maharashtra',
    streetAddress: 'Flat 4B, Sea View Apartments',
    latitude: 19.1364,
    longitude: 72.8296,
  },
  drop: {
    pincode: '411001',
    area: 'Pune City',
    district: 'Pune',
    state: 'Maharashtra',
    streetAddress: 'House 12, Lane 3',
    latitude: 18.5196,
    longitude: 73.8553,
  },
  pickupDate: '2026-12-05',
  moveType: 'LOCAL_HOUSEHOLD',
  vehicleType: 'TATA_ACE',
  customerName: 'Asha Verma',
  mobile: '9876543210',
  consent: true,
});

function setup(
  overrides: Partial<{
    quotes: QuoteRepository;
    captcha: CaptchaVerifier;
    whatsappNumber: string | undefined;
  }> = {},
) {
  const saved: QuoteRequest[] = [];
  const consents: ConsentRecord[] = [];
  const quotes: QuoteRepository = overrides.quotes ?? {
    save: (q) => {
      saved.push(q);
      return Promise.resolve();
    },
    existsByReference: () => Promise.resolve(false),
    deleteOlderThan: () => Promise.resolve(0),
    ping: () => Promise.resolve(),
  };
  const useCase = new CreateQuoteRequest({
    quotes,
    consents: {
      save: (c) => (consents.push(c), Promise.resolve()),
      deleteOlderThan: () => Promise.resolve(0),
      ping: () => Promise.resolve(),
    },
    clock,
    ids: ids(),
    captcha: overrides.captcha ?? okCaptcha,
    idempotency: new MemoryIdempotency(),
    logger,
    businessName: 'RS Packers & Movers',
    whatsappNumber: 'whatsappNumber' in overrides ? overrides.whatsappNumber : '+91 99999 00000',
  });
  return { useCase, saved, consents };
}

describe('CreateQuoteRequest', () => {
  it('stores the quote, records separate quotation consent and builds the WhatsApp URL', async () => {
    const { useCase, saved, consents } = setup();
    const res = await useCase.execute(payload, { visitorId: 'visitor-1' });
    expect(res.referenceNumber).toBe('RSPM-20261126-ABCD');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.consentReference).toBe(consents[0]!.consentId);
    expect(consents[0]).toMatchObject({
      purpose: 'QUOTATION',
      analytics: false,
      marketing: false,
      visitorId: 'visitor-1',
    });
    expect(res.whatsapp.url).toContain('https://wa.me/919999900000?text=');
    expect(saved[0]!.distanceKm).toBeGreaterThan(100);
    expect(res).not.toHaveProperty('estimate');
    expect(JSON.stringify(res)).not.toMatch(/₹|price|estimate/i);
  });

  it('omits the WhatsApp URL when no business number is configured but still returns the message', async () => {
    const { useCase } = setup({ whatsappNumber: undefined });
    const res = await useCase.execute(payload);
    expect(res.whatsapp.url).toBeUndefined();
    expect(res.whatsapp.message).toContain('RSPM-');
  });

  it('retries with a new reference on collision', async () => {
    const saved: QuoteRequest[] = [];
    let calls = 0;
    const { useCase } = setup({
      quotes: {
        save: (q) => {
          if (calls++ === 0) return Promise.reject(new DuplicateReferenceError(q.referenceNumber));
          saved.push(q);
          return Promise.resolve();
        },
        existsByReference: () => Promise.resolve(false),
        deleteOlderThan: () => Promise.resolve(0),
        ping: () => Promise.resolve(),
      },
    });
    const res = await useCase.execute(payload);
    expect(calls).toBe(2);
    expect(saved[0]!.referenceNumber).toBe(res.referenceNumber);
    expect(res.referenceNumber).toBe('RSPM-20261126-EFGH');
  });

  it('rejects honeypot and failed captcha before touching storage', async () => {
    const { useCase, saved } = setup({ captcha: badCaptcha });
    await expect(useCase.execute({ ...payload, website: 'bot' })).rejects.toMatchObject({
      code: 'SUBMISSION_REJECTED',
    });
    await expect(useCase.execute(payload)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
    expect(saved).toHaveLength(0);
  });

  it('is idempotent for identical concurrent submissions', async () => {
    const { useCase, saved } = setup();
    const [a, b, c] = await Promise.all([
      useCase.execute(payload),
      useCase.execute(payload),
      useCase.execute(payload),
    ]);
    expect(a.referenceNumber).toBe(b.referenceNumber);
    expect(b.referenceNumber).toBe(c.referenceNumber);
    expect(saved).toHaveLength(1);
  });

  it('rejects a pickup date in the past (IST)', async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ ...payload, pickupDate: '2026-11-25' })).rejects.toMatchObject({
      code: 'PICKUP_DATE_INVALID',
    });
  });

  it('treats the same PIN codes with different typed addresses as different quotes', async () => {
    const { useCase, saved } = setup();
    const other = quoteRequestSchema.parse({
      ...payload,
      pickup: { ...payload.pickup, streetAddress: 'Flat 9C, Another Building' },
    });
    const [a, b] = await Promise.all([useCase.execute(payload), useCase.execute(other)]);
    expect(a.referenceNumber).not.toBe(b.referenceNumber);
    expect(saved).toHaveLength(2);
  });
});

const office = (name: string): PostOfficeEntry => ({
  id: `751002:${name}`,
  name,
  pincode: '751002',
  district: 'Khorda',
  state: 'Odisha',
});

describe('LookupPincode', () => {
  it('returns the post offices of the PIN code from the directory', async () => {
    const directory: PincodeDirectory = {
      lookup: (pin) => Promise.resolve(pin === '751002' ? [office('Sundarpada')] : []),
    };
    const uc = new LookupPincode(directory);
    expect(await uc.execute('751002')).toEqual({
      pincode: '751002',
      offices: [office('Sundarpada')],
    });
    expect(await uc.execute('999999')).toEqual({ pincode: '999999', offices: [] });
  });
});

describe('ResolveArea', () => {
  const query = { pincode: '751002', name: 'Sundarpada', district: 'Khorda', state: 'Odisha' };
  const area: ResolvedArea = {
    ...query,
    areaLabel: 'Sundarpada, Khorda, Odisha - 751002',
    latitude: 20.21,
    longitude: 85.8,
    confidence: 'high',
    source: 'open-meteo',
  };

  it('returns the located area', async () => {
    const geocoder: AreaGeocoder = { locate: () => Promise.resolve(area) };
    expect(await new ResolveArea(geocoder).execute(query)).toEqual(area);
  });

  it('turns "not found anywhere" into a typed upstream error', async () => {
    const geocoder: AreaGeocoder = { locate: () => Promise.resolve(null) };
    await expect(new ResolveArea(geocoder).execute(query)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
});

describe('TrackVisit', () => {
  const saved: unknown[] = [];
  const visitors = {
    recordVisit: (p: unknown) => (saved.push(p), Promise.resolve()),
    deleteOlderThan: () => Promise.resolve(0),
    ping: () => Promise.resolve(),
  };
  const uc = new TrackVisit({ visitors, clock });
  const event = { type: 'page_view' as const, path: '/a?lat=1', language: 'en-IN' };

  it('stores nothing without proven analytics consent or visitor id', async () => {
    expect(await uc.execute(event, { consent: undefined, visitorId: 'v' })).toBe(false);
    expect(await uc.execute(event, { consent: { analytics: false }, visitorId: 'v' })).toBe(false);
    expect(await uc.execute(event, { consent: { analytics: true }, visitorId: undefined })).toBe(
      false,
    );
    expect(saved).toHaveLength(0);
  });

  it('ignores bots and records a minimal profile otherwise', async () => {
    expect(
      await uc.execute(event, {
        consent: { analytics: true },
        visitorId: 'v',
        userAgent: 'Googlebot/2.1',
      }),
    ).toBe(false);
    expect(
      await uc.execute(event, {
        consent: { analytics: true },
        visitorId: 'v',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537',
        region: 'IN',
      }),
    ).toBe(true);
    expect(saved[0]).toMatchObject({
      landingPage: '/a',
      deviceCategory: 'DESKTOP',
      region: 'IN',
      referralCategory: 'DIRECT',
    });
  });
});

describe('PurgeExpiredData', () => {
  it('uses the retention window for every store', async () => {
    const cutoffs: number[] = [];
    const store = { deleteOlderThan: (d: Date) => (cutoffs.push(d.getTime()), Promise.resolve(2)) };
    const result = await new PurgeExpiredData({
      quotes: store,
      contacts: store,
      consents: store,
      visitors: store,
      clock,
      logger,
      retentionDays: 30,
    }).execute();
    expect(result).toEqual({ quotes: 2, contacts: 2, consents: 2, visitors: 2 });
    expect(new Set(cutoffs).size).toBe(1);
    expect(now.getTime() - cutoffs[0]!).toBe(30 * 86_400_000);
  });
});

describe('ApplicationError', () => {
  it('carries a typed code', () => {
    expect(new ApplicationError('CAPTCHA_FAILED', 'x').code).toBe('CAPTCHA_FAILED');
  });
});
