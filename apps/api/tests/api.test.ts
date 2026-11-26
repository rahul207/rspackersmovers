import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUOTE_REFERENCE_PATTERN } from '@rs/domain';
import { ApplicationError } from '@rs/application';
import {
  BHUBANESWAR,
  MUMBAI,
  PUNE,
  createTestApp,
  futureDate,
  validQuote,
  type TestApp,
} from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

async function rows(file: string): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.worksheets[0]!;
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const out: Record<string, unknown>[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const values = (row.values as unknown[]).slice(1);
    out.push(Object.fromEntries(headers.map((h, i) => [h, values[i]])));
  });
  return out;
}

describe('system endpoints', () => {
  it('reports health and readiness with the response envelope and a correlation id', async () => {
    const health = await t.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-correlation-id': 'test-correlation-1234' },
    });
    expect(health.statusCode).toBe(200);
    expect(health.headers['x-correlation-id']).toBe('test-correlation-1234');
    expect(health.json()).toMatchObject({
      success: true,
      data: { status: 'ok' },
      meta: { correlationId: 'test-correlation-1234' },
    });

    const ready = await t.app.inject({ method: 'GET', url: '/api/v1/readiness' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.checks).toEqual({
      quotes: 'ok',
      contacts: 'ok',
      consents: 'ok',
      visitors: 'ok',
    });
  });

  it('returns a typed 404 envelope for unknown and removed API routes', async () => {
    for (const url of ['/api/v1/nope', '/api/v1/locations/search?q=pune']) {
      const res = await t.app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    }
    const removed = await t.post('/api/v1/price-estimates', { distanceKm: 5 });
    expect(removed.statusCode).toBe(404);
  });

  it('serves robots.txt, sitemap.xml and OpenAPI docs without any price endpoint', async () => {
    expect((await t.app.inject({ url: '/robots.txt' })).body).toContain(
      'Sitemap: http://localhost:5173/sitemap.xml',
    );
    expect((await t.app.inject({ url: '/sitemap.xml' })).body).toContain(
      '<loc>http://localhost:5173/</loc>',
    );
    const spec = (await t.app.inject({ url: '/api/docs/json' })).json();
    const paths = Object.keys(spec.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/quotes',
        '/api/v1/contact-requests',
        '/api/v1/consents',
        '/api/v1/analytics/events',
        '/api/v1/config/public',
        '/api/v1/locations/pincode/{pincode}',
        '/api/v1/locations/area',
      ]),
    );
    expect(paths.some((p) => /price|estimate/i.test(p))).toBe(false);
  });

  it('exposes public config without secrets or pricing', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/config/public' });
    const text = res.body;
    expect(text).not.toContain('test-session-secret');
    expect(text).not.toContain('test-cookie-secret');
    expect(text).not.toMatch(/pricing|price|₹/i);
    const cfg = res.json().data;
    expect(cfg.business.whatsappNumber).toBe('919999900000');
    expect(cfg).not.toHaveProperty('pricing');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('CSRF and request hygiene', () => {
  it('rejects mutating requests without a CSRF token', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      payload: validQuote(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_INVALID');
  });

  it('rejects a forged token and a foreign Origin', async () => {
    const forged = await t.post('/api/v1/quotes', {}, { headers: { 'x-csrf-token': 'abc.def' } });
    expect(forged.statusCode).toBe(403);
    const foreign = await t.post(
      '/api/v1/quotes',
      {},
      { headers: { origin: 'https://evil.example' } },
    );
    expect(foreign.statusCode).toBe(403);
  });

  it('rejects oversized bodies, wrong content types and malformed JSON with typed errors', async () => {
    const big = await t.post('/api/v1/contact-requests', { message: 'x'.repeat(40_000) });
    expect(big.statusCode).toBe(413);
    expect(big.json().error.code).toBe('PAYLOAD_TOO_LARGE');

    const wrongType = await t.app.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      payload: 'a=b',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrf-token': t.csrf.token,
        cookie: t.csrf.cookie,
      },
    });
    expect(wrongType.statusCode).toBe(415);
    expect(wrongType.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const badJson = await t.app.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      payload: '{"vehicleType":',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': t.csrf.token,
        cookie: t.csrf.cookie,
      },
    });
    expect(badJson.statusCode).toBe(400);
    expect(badJson.json().success).toBe(false);
  });

  it('rate limits API calls', async () => {
    const limited = await createTestApp({ RATE_LIMIT_MAX: '4' });
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push((await limited.app.inject({ url: '/api/v1/health' })).statusCode);
    expect(codes.slice(-1)[0]).toBe(429);
    const last = await limited.app.inject({ url: '/api/v1/health' });
    expect(last.json().error.code).toBe('RATE_LIMITED');
    await limited.close();
  });
});

describe('PIN code location lookup', () => {
  const get = (url: string) => t.app.inject({ method: 'GET', url });

  it('lists the post offices of a PIN code', async () => {
    const res = await get('/api/v1/locations/pincode/400053');
    expect(res.statusCode).toBe(200);
    const { pincode, offices } = res.json().data;
    expect(pincode).toBe('400053');
    expect(offices.map((o: { name: string }) => o.name)).toEqual(['Andheri West', 'Versova']);
    expect(offices[0]).toMatchObject({
      id: '400053:Andheri West',
      district: 'Mumbai',
      state: 'Maharashtra',
      branchType: 'Sub Post Office',
    });
  });

  it('returns an empty list (not an error) for an unknown PIN code', async () => {
    const res = await get('/api/v1/locations/pincode/999999');
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ pincode: '999999', offices: [] });
  });

  it.each(['12345', '1234567', 'abcdef', '051002'])(
    'rejects the malformed PIN code %s',
    async (pin) => {
      const res = await get(`/api/v1/locations/pincode/${pin}`);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_FAILED');
      expect(res.json().error.fieldErrors.pincode).toBeDefined();
    },
  );

  it('finds the coordinates of the chosen area', async () => {
    const q = new URLSearchParams({
      pincode: '751002',
      name: 'Sundarpada',
      district: 'Khorda',
      state: 'Odisha',
    });
    const res = await get(`/api/v1/locations/area?${q}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      areaLabel: 'Sundarpada, Khorda, Odisha - 751002',
      latitude: 20.2146,
      longitude: 85.8043,
      confidence: 'high',
    });
  });

  it('validates the area query and reports an area that cannot be found without leaking details', async () => {
    const bad = await get('/api/v1/locations/area?pincode=75&name=x');
    expect(bad.statusCode).toBe(400);
    const q = new URLSearchParams({
      pincode: '751002',
      name: 'Nowhere',
      district: 'Khorda',
      state: 'Odisha',
    });
    const missing = await get(`/api/v1/locations/area?${q}`);
    expect(missing.statusCode).toBe(502);
    expect(missing.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('turns an unavailable PIN directory into a sanitised 502', async () => {
    const down = await createTestApp(
      {},
      {
        pincodeDirectory: {
          lookup: () =>
            Promise.reject(
              new ApplicationError(
                'UPSTREAM_UNAVAILABLE',
                'The PIN code directory is not responding right now.',
              ),
            ),
        },
      },
    );
    const res = await down.app.inject({ method: 'GET', url: '/api/v1/locations/pincode/751002' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
    await down.close();
  });
});

describe('quote requests', () => {
  it('stores the quote and returns a reference and an encoded WhatsApp URL - and no price', async () => {
    const res = await t.post(
      '/api/v1/quotes',
      validQuote({ notes: 'Fragile: piano & "glass" table' }),
    );
    expect(res.statusCode).toBe(201);
    const q = res.json().data;
    expect(q.referenceNumber).toMatch(QUOTE_REFERENCE_PATTERN);
    expect(q).not.toHaveProperty('estimate');
    expect(JSON.stringify(q)).not.toMatch(/₹|price|estimate|total|amount/i);
    expect(q.whatsapp.url.startsWith('https://wa.me/919999900000?text=')).toBe(true);
    expect(q.whatsapp.url).not.toContain(' ');
    const decoded = decodeURIComponent(q.whatsapp.url.split('?text=')[1]);
    expect(decoded).toBe(q.whatsapp.message);
    expect(decoded).toContain(q.referenceNumber);
    expect(decoded).toContain('Fragile: piano & "glass" table');
    expect(decoded).toContain(
      'Pickup: Flat 4B, Sea View Apartments, Link Road, Andheri West, Mumbai, Maharashtra - 400053',
    );
    expect(decoded).toContain('Drop: House 12, Lane 3, near City Post Office, Pune City, Pune');
    expect(decoded).toContain('19.13640, 72.82960');

    const stored = (await rows(t.env.QUOTES_XLSX_PATH)).find(
      (r) => r['Reference number'] === q.referenceNumber,
    )!;
    expect(stored['Customer name']).toBe('Asha Verma');
    expect(stored['Mobile number']).toBe('919876543210');
    expect(stored['Pickup address']).toBe(
      'Flat 4B, Sea View Apartments, Link Road, Andheri West, Mumbai, Maharashtra - 400053',
    );
    expect(stored['Pickup PIN code']).toBe('400053');
    expect(stored['Drop PIN code']).toBe('411001');
    expect(stored['Pickup latitude']).toBe(19.1364);
    expect(Number(stored['Distance (km)'])).toBeGreaterThan(100);
    expect(stored['Status']).toBe('NEW');
    expect(Object.keys(stored).some((k) => /price/i.test(k) && stored[k] != null)).toBe(false);
  });

  it('rebuilds the address from its parts, ignoring a forged address field', async () => {
    const res = await t.post(
      '/api/v1/quotes',
      validQuote({
        mobile: '90000 44444',
        pickup: { ...MUMBAI, address: 'FORGED, Somewhere Else - 110001' },
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().data.whatsapp.message).not.toContain('FORGED');
  });

  it('collapses duplicate and concurrent identical submissions into one stored quote', async () => {
    const body = validQuote({ mobile: '90000 11111', drop: BHUBANESWAR });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => t.post('/api/v1/quotes', body)),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const refs = new Set(results.map((r) => r.json().data.referenceNumber));
    expect(refs.size).toBe(1);
    const stored = (await rows(t.env.QUOTES_XLSX_PATH)).filter(
      (r) => r['Mobile number'] === '919000011111',
    );
    expect(stored).toHaveLength(1);
  });

  it('stores many different concurrent submissions without corruption or lost writes', async () => {
    const before = (await rows(t.env.QUOTES_XLSX_PATH)).length;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        t.post(
          '/api/v1/quotes',
          validQuote({
            mobile: `9700000${String(i).padStart(3, '0')}`,
            customerName: `Customer ${i}`,
          }),
        ),
      ),
    );
    expect(results.map((r) => r.statusCode)).toEqual(Array(12).fill(201));
    const refs = new Set(results.map((r) => r.json().data.referenceNumber));
    expect(refs.size).toBe(12);
    const after = await rows(t.env.QUOTES_XLSX_PATH);
    expect(after.length).toBe(before + 12);
  });

  it('neutralises formula injection and strips markup before storing', async () => {
    const res = await t.post(
      '/api/v1/quotes',
      validQuote({
        mobile: '9123456789',
        customerName: '=HYPERLINK("http://evil","click")',
        notes: '<script>alert(1)</script>+cmd|calc',
        pickup: { ...MUMBAI, streetAddress: '=cmd|calc, Flat 1' },
      }),
    );
    expect(res.statusCode).toBe(201);
    const row = (await rows(t.env.QUOTES_XLSX_PATH)).find(
      (r) => r['Reference number'] === res.json().data.referenceNumber,
    )!;
    expect(String(row['Customer name'])).toBe(`'=HYPERLINK("http://evil","click")`);
    expect(String(row['Notes'])).toBe('alert(1)+cmd|calc');
    expect(String(row['Pickup address']).startsWith("'=cmd|calc")).toBe(true);
  });

  it('rejects invalid, past-dated and bot submissions with sanitised errors', async () => {
    const badMobile = await t.post('/api/v1/quotes', validQuote({ mobile: '12345' }));
    expect(badMobile.statusCode).toBe(400);
    expect(badMobile.json().error.fieldErrors.mobile).toBeDefined();

    const noConsent = await t.post('/api/v1/quotes', validQuote({ consent: false }));
    expect(noConsent.json().error.fieldErrors.consent).toBeDefined();

    const noArea = await t.post('/api/v1/quotes', validQuote({ pickup: { pincode: '400053' } }));
    expect(noArea.statusCode).toBe(400);
    expect(noArea.json().error.fieldErrors['pickup.area']).toBeDefined();
    expect(noArea.json().error.fieldErrors['pickup.latitude']).toBeDefined();

    const shortStreet = await t.post(
      '/api/v1/quotes',
      validQuote({ drop: { ...PUNE, streetAddress: '12' } }),
    );
    expect(shortStreet.statusCode).toBe(400);
    expect(shortStreet.json().error.fieldErrors['drop.streetAddress']).toBeDefined();

    const badPin = await t.post(
      '/api/v1/quotes',
      validQuote({ pickup: { ...MUMBAI, pincode: '12' } }),
    );
    expect(badPin.json().error.fieldErrors['pickup.pincode']).toBeDefined();

    const past = await t.post('/api/v1/quotes', validQuote({ pickupDate: '2020-01-01' }));
    expect(past.statusCode).toBe(400);
    expect(past.json().error.fieldErrors.pickupDate).toBeDefined();

    const bot = await t.post('/api/v1/quotes', validQuote({ website: 'http://spam.example' }));
    expect(bot.statusCode).toBe(400);
    expect(bot.json().error.code).toBe('SUBMISSION_REJECTED');
    expect(JSON.stringify(bot.json())).not.toContain('spam.example');
  });

  it('accepts a long-distance move: there is no automatic price to refuse', async () => {
    const res = await t.post(
      '/api/v1/quotes',
      validQuote({
        mobile: '9555500000',
        pickup: { ...BHUBANESWAR, latitude: 8.0883, longitude: 77.5385 },
        drop: { ...PUNE, latitude: 34.0837, longitude: 74.7973 },
        pickupDate: futureDate(10),
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().data.whatsapp.message).toMatch(/Approximate distance: \d+(\.\d)? km/);
  });
});

describe('contact requests', () => {
  const contact = (o: Record<string, unknown> = {}) => ({
    name: 'Ravi Kumar',
    mobile: '9811122233',
    email: '',
    subject: 'Storage options',
    message: 'Do you offer short-term storage in Pune?',
    preferredContactMethod: 'WHATSAPP',
    consent: true,
    sourcePage: '/',
    ...o,
  });

  it('stores a contact request and returns a reference', async () => {
    const res = await t.post('/api/v1/contact-requests', contact());
    expect(res.statusCode).toBe(201);
    expect(res.json().data.requestId).toMatch(/^RSPM-C-\d{8}-[A-Z0-9]{4}$/);
    const stored = await rows(t.env.CONTACTS_XLSX_PATH);
    expect(stored.find((r) => r['Request ID'] === res.json().data.requestId)).toMatchObject({
      Name: 'Ravi Kumar',
      Status: 'NEW',
    });
  });

  it('prevents duplicate submissions and enforces conditional email', async () => {
    const [a, b] = await Promise.all([
      t.post('/api/v1/contact-requests', contact({ mobile: '9822233344' })),
      t.post('/api/v1/contact-requests', contact({ mobile: '9822233344' })),
    ]);
    expect(a.json().data.requestId).toBe(b.json().data.requestId);
    const needsEmail = await t.post(
      '/api/v1/contact-requests',
      contact({ mobile: '9833344455', preferredContactMethod: 'EMAIL' }),
    );
    expect(needsEmail.statusCode).toBe(400);
    expect(needsEmail.json().error.fieldErrors.email).toBeDefined();
    const honeypot = await t.post(
      '/api/v1/contact-requests',
      contact({ mobile: '9844455566', website: 'x' }),
    );
    expect(honeypot.json().error.code).toBe('SUBMISSION_REJECTED');
  });
});

describe('consent and analytics', () => {
  const consent = (o: Record<string, unknown> = {}) => ({
    analytics: false,
    marketing: false,
    location: false,
    consentVersion: '2026-01',
    privacyNoticeVersion: '2026-01-draft',
    ...o,
  });
  const cookiesOf = (res: Awaited<ReturnType<TestApp['post']>>) =>
    res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const event = {
    type: 'page_view',
    path: '/services?lat=19.07&lon=72.87',
    referrer: 'https://www.google.com/search?q=x',
    language: 'en-IN',
  };

  it('does not record analytics without consent, and records a minimal profile with consent', async () => {
    const none = await t.post('/api/v1/analytics/events', event);
    expect(none.json().data.recorded).toBe(false);

    const rejected = await t.post('/api/v1/consents', consent());
    expect(rejected.statusCode).toBe(201);
    const afterReject = await t.post('/api/v1/analytics/events', event, {
      cookie: cookiesOf(rejected),
    });
    expect(afterReject.json().data.recorded).toBe(false);

    const accepted = await t.post('/api/v1/consents', consent({ analytics: true }));
    const cookie = cookiesOf(accepted);
    const httpOnly = accepted.cookies.filter(
      (c) => c.name.startsWith('rs_') && c.name !== 'rs_csrf',
    );
    expect(httpOnly.length).toBe(2);
    expect(httpOnly.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);

    const rec = await t.post('/api/v1/analytics/events', event, {
      cookie,
      headers: {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Mobile Safari/604',
        'cf-ipcountry': 'IN',
      },
    });
    expect(rec.json().data.recorded).toBe(true);

    const second = await t.post(
      '/api/v1/analytics/events',
      { ...event, path: '/about' },
      { cookie },
    );
    expect(second.json().data.recorded).toBe(true);

    const visitors = await rows(t.env.VISITORS_XLSX_PATH);
    expect(visitors).toHaveLength(1);
    expect(visitors[0]).toMatchObject({
      'Landing page': '/services',
      'Referral category': 'SEARCH',
      'Device category': 'MOBILE',
      'Operating system family': 'iOS',
      'Approximate country/region': 'IN',
      'Consent status': 'ANALYTICS_GRANTED',
    });
    expect(JSON.stringify(visitors)).not.toMatch(/lat=|19\.07|Mozilla/);

    const consents = await rows(t.env.CONSENTS_XLSX_PATH);
    expect(
      consents.some(
        (c) =>
          c['Analytics cookies'] === 'GRANTED' &&
          c['Marketing cookies'] === 'DENIED' &&
          c['Privacy notice version'] === '2026-01-draft',
      ),
    ).toBe(true);
  });

  it('ignores a tampered consent cookie', async () => {
    const res = await t.post('/api/v1/analytics/events', event, {
      cookie: `rs_consent=${encodeURIComponent('{"analytics":true,"marketing":true,"location":true,"version":"x"}.forged')}; rs_vid=11111111-1111-1111-1111-111111111111.forged`,
    });
    expect(res.json().data.recorded).toBe(false);
  });

  it('keeps quotation consent separate from cookie categories', async () => {
    const quote = await t.post('/api/v1/quotes', validQuote({ mobile: '9777788888' }));
    const consents = await rows(t.env.CONSENTS_XLSX_PATH);
    const rec = consents.filter((c) => c['Purpose'] === 'QUOTATION').at(-1)!;
    expect(quote.statusCode).toBe(201);
    expect(rec).toMatchObject({
      'Analytics cookies': 'DENIED',
      'Marketing cookies': 'DENIED',
      'Location processing': 'DENIED',
    });
  });
});

describe('privacy of logs', () => {
  it('never writes personal data, typed addresses, PIN codes, coordinates or secrets to logs', async () => {
    await t.post(
      '/api/v1/quotes',
      validQuote({
        customerName: 'Unique Logtest Person',
        mobile: '9666655555',
        email: 'logtest@example.com',
        pickup: { ...MUMBAI, streetAddress: 'Secret Lane Number 77' },
      }),
    );
    await t.app.inject({ method: 'GET', url: '/api/v1/locations/pincode/751002' });
    await t.app.inject({
      method: 'GET',
      url: '/api/v1/locations/area?pincode=751002&name=Sundarpada&district=Khorda&state=Odisha',
    });
    const all = t.logs.join('\n');
    expect(all.length).toBeGreaterThan(0);
    for (const forbidden of [
      'Unique Logtest',
      '9666655555',
      'logtest@example.com',
      'Secret Lane',
      'Maharashtra',
      '751002',
      'Sundarpada',
      '19.1364',
      '72.8296',
      'test-session-secret',
      'rs_csrf',
    ]) {
      expect(all).not.toContain(forbidden);
    }
    expect(all).toContain('quote.created');
  });
});
