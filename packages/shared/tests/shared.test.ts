import { describe, expect, it } from 'vitest';
import {
  areaQuerySchema,
  contactRequestSchema,
  estimateRoadDistanceKm,
  formatIndianMobile,
  haversineKm,
  normalizeIndianMobile,
  normalizeInternationalNumber,
  pincodeSchema,
  quoteLocationSchema,
  quoteRequestSchema,
  sanitizeMultiline,
  sanitizeSingleLine,
} from '../src';

const pickup = {
  pincode: '400053',
  area: 'Andheri West',
  district: 'Mumbai',
  state: 'Maharashtra',
  streetAddress: 'Flat 4B, Sea View Apartments, Link Road',
  latitude: 19.1364,
  longitude: 72.8296,
};
const drop = {
  pincode: '411001',
  area: 'Pune City',
  district: 'Pune',
  state: 'Maharashtra',
  streetAddress: 'House 12, Lane 3, near City Post Office',
  latitude: 18.5196,
  longitude: 73.8553,
};
const baseQuote = {
  pickup,
  drop,
  pickupDate: '2030-01-15',
  moveType: 'LOCAL_HOUSEHOLD',
  vehicleType: 'TATA_ACE',
  customerName: 'Asha',
  mobile: '+91 98765-43210',
  consent: true,
};

describe('phone helpers', () => {
  it.each([
    ['98765 43210', '919876543210'],
    ['+91 98765 43210', '919876543210'],
    ['09876543210', '919876543210'],
    ['(91) 98765-43210', '919876543210'],
  ])('normalises %s', (input, expected) => expect(normalizeIndianMobile(input)).toBe(expected));

  it.each(['12345', '5876543210', 'abcdefghij', '+1 202 555 0100'])('rejects %s', (v) =>
    expect(normalizeIndianMobile(v)).toBeNull(),
  );

  it('formats and validates international numbers', () => {
    expect(formatIndianMobile('919876543210')).toBe('+91 98765 43210');
    expect(normalizeInternationalNumber('+91 (98765) 43-210')).toBe('919876543210');
    expect(normalizeInternationalNumber('098765 43210')).toBeNull();
  });
});

describe('sanitisation', () => {
  it('strips tags, control and bidi characters and collapses whitespace', () => {
    expect(sanitizeSingleLine('  Hello \u202E<b>World</b>\u0000   there ')).toBe(
      'Hello World there',
    );
  });
  it('keeps line breaks but limits blank lines', () => {
    expect(sanitizeMultiline('a\r\n\r\n\r\n\r\nb  c')).toBe('a\n\nb c');
  });
});

describe('geo', () => {
  it('computes great-circle distance', () => {
    expect(
      haversineKm(
        { latitude: 19.076, longitude: 72.8777 },
        { latitude: 18.5204, longitude: 73.8567 },
      ),
    ).toBeCloseTo(120, -1);
    expect(estimateRoadDistanceKm(pickup, pickup, 1.3)).toBe(0);
  });
});

describe('PIN code and location schemas', () => {
  it.each(['751002', '400 053', ' 110001 '])('accepts %j', (v) =>
    expect(pincodeSchema.safeParse(v).success).toBe(true),
  );
  it.each(['75100', '7510022', '051002', 'abcdef', '', '75-1002'])('rejects %j', (v) =>
    expect(pincodeSchema.safeParse(v).success).toBe(false),
  );

  it('rebuilds the address from its parts so it cannot disagree with them', () => {
    const l = quoteLocationSchema.parse({ ...pickup, address: 'IGNORED, Delhi - 110001' });
    expect(l.address).toBe(
      'Flat 4B, Sea View Apartments, Link Road, Andheri West, Mumbai, Maharashtra - 400053',
    );
  });

  it('requires the area, a typed street address and coordinates', () => {
    expect(quoteLocationSchema.safeParse({ ...pickup, streetAddress: '12' }).success).toBe(false);
    expect(quoteLocationSchema.safeParse({ ...pickup, area: '' }).success).toBe(false);
    const { latitude: _lat, ...noLat } = pickup;
    expect(quoteLocationSchema.safeParse(noLat).success).toBe(false);
    expect(quoteLocationSchema.safeParse({ ...pickup, latitude: 123 }).success).toBe(false);
  });

  it('strips markup and rounds coordinates', () => {
    const l = quoteLocationSchema.parse({
      ...pickup,
      streetAddress: '<b>Flat 9</b>, Main Road',
      latitude: 19.13641234567,
    });
    expect(l.streetAddress).toBe('Flat 9, Main Road');
    expect(l.latitude).toBe(19.136412);
  });

  it('validates area lookups', () => {
    expect(
      areaQuerySchema.safeParse({
        pincode: '751002',
        name: 'Sundarpada',
        district: 'Khorda',
        state: 'Odisha',
      }).success,
    ).toBe(true);
    expect(areaQuerySchema.safeParse({ pincode: '1', name: 'x' }).success).toBe(false);
  });
});

describe('request schemas', () => {
  it('accepts a valid quote and normalises it', () => {
    const q = quoteRequestSchema.parse({ ...baseQuote, email: '', notes: ' <b>Fragile</b> ' });
    expect(q.mobile).toBe('919876543210');
    expect(q.email).toBeUndefined();
    expect(q.notes).toBe('Fragile');
    expect(q.sourcePage).toBe('/');
    expect(q.pickup.address).toContain('Andheri West');
    expect(q.drop.pincode).toBe('411001');
  });

  it('never carries a price or estimate options', () => {
    const q = quoteRequestSchema.parse({ ...baseQuote, estimateOptions: { rooms: 3 } });
    expect(q).not.toHaveProperty('estimateOptions');
  });

  it('rejects a location that has no chosen area', () => {
    const r = quoteRequestSchema.safeParse({ ...baseQuote, pickup: { pincode: '400053' } });
    expect(r.success).toBe(false);
  });

  it('requires explicit quotation consent', () => {
    expect(quoteRequestSchema.safeParse({ ...baseQuote, consent: false }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...baseQuote, consent: undefined }).success).toBe(false);
  });

  it('strips query strings from the source page and rejects odd paths', () => {
    expect(
      quoteRequestSchema.parse({ ...baseQuote, sourcePage: '/services?lat=19.1&lon=72.8#x' })
        .sourcePage,
    ).toBe('/services');
    expect(
      quoteRequestSchema.safeParse({ ...baseQuote, sourcePage: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('requires an email when email contact is preferred', () => {
    const base = {
      name: 'Ravi',
      mobile: '9811122233',
      subject: 'Hello',
      message: 'A long enough message',
      consent: true,
    };
    expect(
      contactRequestSchema.safeParse({ ...base, preferredContactMethod: 'EMAIL' }).success,
    ).toBe(false);
    expect(
      contactRequestSchema.safeParse({ ...base, preferredContactMethod: 'EMAIL', email: 'a@b.co' })
        .success,
    ).toBe(true);
  });
});
