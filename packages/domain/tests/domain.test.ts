import { describe, expect, it } from 'vitest';
import {
  DuplicateReferenceError,
  PickupDateError,
  QUOTE_REFERENCE_PATTERN,
  ROAD_DISTANCE_FACTOR,
  assertPickupDateAllowed,
  buildQuoteWhatsAppMessage,
  buildReference,
  buildWhatsAppUrl,
  classifyReferral,
  classifyUserAgent,
  createPurposeConsent,
  estimateDistanceKm,
  sanitizeLandingPath,
  toIstDate,
  type Location,
  type QuoteRequest,
} from '../src';

describe('references and dates', () => {
  it('builds RSPM-YYYYMMDD-XXXX references with an unambiguous alphabet', () => {
    let n = 0;
    const ref = buildReference('RSPM', '2026-11-26', () => n++);
    expect(ref).toBe('RSPM-20261126-ABCD');
    expect(ref).toMatch(QUOTE_REFERENCE_PATTERN);
  });

  it('uses IST calendar dates', () => {
    expect(toIstDate(new Date('2026-11-25T20:00:00Z'))).toBe('2026-11-26');
    expect(toIstDate(new Date('2026-11-25T10:00:00Z'))).toBe('2026-11-25');
  });

  it('rejects past pickup dates and dates beyond the horizon', () => {
    expect(() => assertPickupDateAllowed('2026-11-25', '2026-11-26')).toThrow(PickupDateError);
    expect(() => assertPickupDateAllowed('2028-01-01', '2026-11-26')).toThrow(PickupDateError);
    expect(() => assertPickupDateAllowed('2026-11-26', '2026-11-26')).not.toThrow();
  });

  it('has a typed duplicate reference error', () => {
    expect(new DuplicateReferenceError('X').code).toBe('DUPLICATE_REFERENCE');
  });
});

const mumbai: Location = {
  address: 'Flat 4B, Sea View, Link Road, Andheri West, Mumbai, Maharashtra - 400053',
  latitude: 19.1364,
  longitude: 72.8296,
  pincode: '400053',
  area: 'Andheri West',
  district: 'Mumbai',
  state: 'Maharashtra',
  streetAddress: 'Flat 4B, Sea View, Link Road',
};
const pune: Location = {
  address: 'House 12, Lane 3, Pune City, Pune, Maharashtra - 411001',
  latitude: 18.5196,
  longitude: 73.8553,
  pincode: '411001',
  area: 'Pune City',
  district: 'Pune',
  state: 'Maharashtra',
  streetAddress: 'House 12, Lane 3',
};

describe('distance', () => {
  it('is an approximate road distance between the two area centres', () => {
    const km = estimateDistanceKm(mumbai, pune);
    expect(km).toBeGreaterThan(120);
    expect(km).toBeLessThan(180);
    expect(estimateDistanceKm(mumbai, mumbai)).toBe(0);
    expect(ROAD_DISTANCE_FACTOR).toBeGreaterThan(1);
  });
});

describe('WhatsApp message and URL', () => {
  const quote: QuoteRequest = {
    referenceNumber: 'RSPM-20261126-ABCD',
    createdAt: new Date('2026-11-26T05:44:00Z'),
    customerName: 'Asha Verma',
    mobile: '919876543210',
    pickup: mumbai,
    drop: pune,
    distanceKm: 150.2,
    moveType: 'INTERCITY_HOUSEHOLD',
    vehicleType: 'TRUCK_17FT',
    pickupDate: '2026-12-01',
    notes: 'Piano & "fragile" glass #5',
    consentReference: 'c1',
    status: 'NEW',
    sourcePage: '/',
  };

  it('contains every required field, including the full typed addresses', () => {
    const msg = buildQuoteWhatsAppMessage(quote, 'RS Packers & Movers');
    for (const part of [
      'RSPM-20261126-ABCD',
      'Asha Verma',
      '+91 98765 43210',
      'Intercity household shifting',
      '17-foot truck',
      'Pickup: Flat 4B, Sea View, Link Road, Andheri West, Mumbai, Maharashtra - 400053',
      '19.13640, 72.82960',
      'Drop: House 12, Lane 3, Pune City, Pune, Maharashtra - 411001',
      '18.51960, 73.85530',
      'Approximate distance: 150.2 km',
      '2026-12-01',
      'Piano & "fragile" glass #5',
      'Source: /',
      '11:14 am IST',
    ]) {
      expect(msg).toContain(part);
    }
  });

  it('never mentions a price, an estimate or a currency amount', () => {
    const msg = buildQuoteWhatsAppMessage(quote, 'RS Packers & Movers');
    expect(msg).not.toMatch(/₹|rs\.?\s?\d|inr|price|estimate|total|amount/i);
  });

  it('URL-encodes the message and strips formatting from the number', () => {
    const msg = 'Hi & bye?\nLine #2 100% = ₹5';
    const url = buildWhatsAppUrl('+91 (98765) 43-210', msg)!;
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(url).not.toMatch(/[ \n"]/);
    expect(url).toContain('%26');
    expect(url).toContain('%0A');
    expect(decodeURIComponent(url.split('?text=')[1]!)).toBe(msg);
  });

  it('refuses an invalid WhatsApp number', () => {
    expect(buildWhatsAppUrl('12', 'x')).toBeNull();
    expect(buildWhatsAppUrl('098765 43210', 'x')).toBeNull();
  });
});

describe('consent and analytics rules', () => {
  it('never turns on optional categories through purpose consent', () => {
    const c = createPurposeConsent({
      consentId: '1',
      timestamp: new Date(),
      visitorId: '',
      purpose: 'QUOTATION',
      consentVersion: 'v',
      privacyNoticeVersion: 'p',
    });
    expect([c.analytics, c.marketing, c.location]).toEqual([false, false, false]);
  });

  it('classifies referrals, devices and landing paths coarsely', () => {
    expect(classifyReferral({ referrerHost: 'www.google.com' })).toBe('SEARCH');
    expect(classifyReferral({ referrerHost: 'l.facebook.com' })).toBe('SOCIAL');
    expect(classifyReferral({ referrerHost: 'blog.example.org' })).toBe('REFERRAL');
    expect(classifyReferral({ referrerHost: 'rspm.example', ownHost: 'rspm.example' })).toBe(
      'DIRECT',
    );
    expect(classifyReferral({ utmMedium: 'cpc' })).toBe('CAMPAIGN');
    expect(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).toMatchObject({
      deviceCategory: 'DESKTOP',
      browserFamily: 'Chrome',
      osFamily: 'Windows',
    });
    expect(classifyUserAgent('Googlebot/2.1').deviceCategory).toBe('BOT');
    expect(sanitizeLandingPath('/services?lat=1&lon=2')).toBe('/services');
    expect(sanitizeLandingPath('//evil.com/<x>')).toBe('/');
  });
});
