import { describe, expect, it, vi } from 'vitest';
import {
  IndiaPostPincodeDirectory,
  OfflineAreaGeocoder,
  OfflinePincodeDirectory,
  OpenAreaGeocoder,
  cleanAreaName,
  sameName,
  sameState,
} from '../src';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

type Handler = (url: URL) => Response | undefined;

/** A fetch stub that answers by URL; anything unhandled behaves like an upstream outage. */
function stubFetch(...handlers: Handler[]) {
  const calls: URL[] = [];
  const fetchImpl = vi.fn((input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    for (const h of handlers) {
      const res = h(url);
      if (res) return Promise.resolve(res);
    }
    return Promise.resolve(jsonResponse({}, false, 503));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const host = (h: string, path?: string, then?: () => Response): Handler => {
  return (url) =>
    url.hostname === h && (!path || url.pathname.includes(path)) ? then?.() : undefined;
};

describe('name matching helpers', () => {
  it('tolerates spelling variants of Indian place names', () => {
    expect(sameName('Khorda', 'Khordha')).toBe(true);
    expect(sameName('Mumbai Suburban', 'Mumbai')).toBe(true);
    expect(sameName('Pune', 'Pune')).toBe(true);
    expect(sameName('Pune', 'Nagpur')).toBe(false);
    expect(sameName(undefined, 'Pune')).toBe(false);
  });

  it('matches states including old and alternative names', () => {
    expect(sameState('Odisha', 'Orissa')).toBe(true);
    expect(sameState('NCT of Delhi', 'Delhi')).toBe(true);
    expect(sameState('Jammu & Kashmir', 'Jammu and Kashmir')).toBe(true);
    expect(sameState('Odisha', 'Karnataka')).toBe(false);
  });

  it('strips office-type suffixes and bracketed districts from post office names', () => {
    expect(cleanAreaName('Old Town (Khorda)')).toBe('Old Town');
    expect(cleanAreaName('Bhimatangi ND')).toBe('Bhimatangi');
    expect(cleanAreaName('Pune GPO')).toBe('Pune');
    expect(cleanAreaName('Anand')).toBe('Anand');
    expect(cleanAreaName('Andheri West')).toBe('Andheri West');
  });
});

describe('IndiaPostPincodeDirectory', () => {
  const body = [
    {
      Status: 'Success',
      PostOffice: [
        {
          Name: 'Sundarpada',
          BranchType: 'Branch Post Office',
          DeliveryStatus: 'Delivery',
          Block: 'Bhubaneswar',
          District: 'Khorda',
          State: 'Odisha',
          Pincode: '751002',
        },
        {
          Name: 'Bankual',
          BranchType: 'Branch Post Office',
          DeliveryStatus: 'Delivery',
          Block: 'NA',
          District: 'Khorda',
          State: 'Odisha',
          Pincode: '751002',
        },
        { Name: 'Bankual', District: 'Khorda', State: 'Odisha', Pincode: '751002' },
        { Name: '', District: 'Khorda', State: 'Odisha' },
      ],
    },
  ];

  it('maps, de-duplicates, cleans and sorts the post offices', async () => {
    const { fetchImpl, calls } = stubFetch(
      host('api.postalpincode.in', '/pincode/751002', () => jsonResponse(body)),
    );
    const dir = new IndiaPostPincodeDirectory(fetchImpl);
    const offices = await dir.lookup('751002');
    expect(calls[0]?.pathname).toBe('/pincode/751002');
    expect(offices.map((o) => o.name)).toEqual(['Bankual', 'Sundarpada']);
    expect(offices[0]).toEqual({
      id: '751002:Bankual',
      name: 'Bankual',
      pincode: '751002',
      branchType: 'Branch Post Office',
      deliveryStatus: 'Delivery',
      district: 'Khorda',
      state: 'Odisha',
    });
    expect(offices[1]?.block).toBe('Bhubaneswar');
  });

  it('caches results per PIN code', async () => {
    const { fetchImpl } = stubFetch(
      host('api.postalpincode.in', undefined, () => jsonResponse(body)),
    );
    const dir = new IndiaPostPincodeDirectory(fetchImpl);
    await dir.lookup('751002');
    await dir.lookup('751002');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for an unknown PIN code (India Post says "No records found")', async () => {
    const { fetchImpl } = stubFetch(
      host('api.postalpincode.in', undefined, () =>
        jsonResponse([{ Message: 'No records found', Status: 'Error', PostOffice: null }]),
      ),
    );
    expect(await new IndiaPostPincodeDirectory(fetchImpl).lookup('999999')).toEqual([]);
  });

  it('never calls the network for a malformed PIN code', async () => {
    const { fetchImpl } = stubFetch();
    expect(await new IndiaPostPincodeDirectory(fetchImpl).lookup('12ab')).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries once, then reports a sanitised upstream error', async () => {
    const { fetchImpl } = stubFetch();
    await expect(new IndiaPostPincodeDirectory(fetchImpl).lookup('751002')).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    let n = 0;
    const flaky = stubFetch(
      host('api.postalpincode.in', undefined, () =>
        n++ === 0 ? jsonResponse({}, false, 500) : jsonResponse(body),
      ),
    );
    expect(await new IndiaPostPincodeDirectory(flaky.fetchImpl).lookup('751002')).toHaveLength(2);
  });
});

describe('OpenAreaGeocoder', () => {
  const query = { pincode: '751002', name: 'Sundarpada', district: 'Khorda', state: 'Odisha' };
  const empty = () => jsonResponse({ results: [] });

  it('1. uses Open-Meteo when the named place matches district and state', async () => {
    const { fetchImpl, calls } = stubFetch(
      host('geocoding-api.open-meteo.com', undefined, () =>
        jsonResponse({
          results: [
            {
              name: 'Sundarpada',
              latitude: 30,
              longitude: 70,
              admin1: 'Punjab',
              admin2: 'Ludhiana',
            },
            {
              name: 'Sundarpada',
              latitude: 20.2146,
              longitude: 85.8043,
              admin1: 'Odisha',
              admin2: 'Khordha',
            },
          ],
        }),
      ),
    );
    const area = await new OpenAreaGeocoder('test-agent', fetchImpl).locate(query);
    expect(area).toEqual({
      ...query,
      areaLabel: 'Sundarpada, Khorda, Odisha - 751002',
      latitude: 20.2146,
      longitude: 85.8043,
      confidence: 'high',
      source: 'open-meteo',
    });
    expect(calls).toHaveLength(1);
  });

  it('never accepts a same-named place in another district or state', async () => {
    const { fetchImpl } = stubFetch(
      (url) =>
        url.hostname === 'geocoding-api.open-meteo.com' &&
        url.searchParams.get('name') === 'Sundarpada'
          ? jsonResponse({
              results: [
                {
                  name: 'Sundarpada',
                  latitude: 1,
                  longitude: 1,
                  admin1: 'Odisha',
                  admin2: 'Ganjam',
                },
                {
                  name: 'Sundarpada',
                  latitude: 2,
                  longitude: 2,
                  admin1: 'Bihar',
                  admin2: 'Khordha',
                },
              ],
            })
          : undefined,
      host('geocoding-api.open-meteo.com', undefined, empty),
      host('photon.komoot.io', undefined, () => jsonResponse({ features: [] })),
      host('nominatim.openstreetmap.org', undefined, () => jsonResponse([])),
    );
    const area = await new OpenAreaGeocoder('test-agent', fetchImpl).locate(query);
    expect(area).toBeNull();
  });

  it('2. falls back to Photon and trusts a PIN code match most', async () => {
    const { fetchImpl } = stubFetch(
      host('geocoding-api.open-meteo.com', undefined, empty),
      host('photon.komoot.io', undefined, () =>
        jsonResponse({
          features: [
            {
              geometry: { coordinates: [75, 25] },
              properties: { state: 'Odisha', district: 'Ganjam' },
            },
            {
              geometry: { coordinates: [85.8, 20.21] },
              properties: { state: 'Odisha', district: 'Khordha', postcode: '751002' },
            },
          ],
        }),
      ),
    );
    const area = await new OpenAreaGeocoder('test-agent', fetchImpl).locate(query);
    expect(area).toMatchObject({
      latitude: 20.21,
      longitude: 85.8,
      confidence: 'high',
      source: 'photon',
    });
  });

  it('3-4. then Nominatim by name, then by PIN code (approximate), throttled to 1 request/second', async () => {
    const { fetchImpl, calls } = stubFetch(
      host('geocoding-api.open-meteo.com', undefined, empty),
      host('photon.komoot.io', undefined, () => jsonResponse({ features: [] })),
      (url) =>
        url.hostname === 'nominatim.openstreetmap.org' && url.searchParams.has('postalcode')
          ? jsonResponse([{ lat: '20.23', lon: '85.83', address: { state: 'Odisha' } }])
          : url.hostname === 'nominatim.openstreetmap.org'
            ? jsonResponse([])
            : undefined,
    );
    const started = Date.now();
    const area = await new OpenAreaGeocoder('test-agent', fetchImpl).locate(query);
    expect(area).toMatchObject({
      latitude: 20.23,
      longitude: 85.83,
      confidence: 'approximate',
      source: 'nominatim',
    });
    const nominatim = calls.filter((c) => c.hostname === 'nominatim.openstreetmap.org');
    expect(nominatim).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
  }, 15_000);

  it('5. finally uses the district centre, and returns null when nothing can place the area', async () => {
    const district = stubFetch(
      host('geocoding-api.open-meteo.com', undefined, () =>
        jsonResponse({
          results: [{ name: 'Khordha', latitude: 20.18, longitude: 85.62, admin1: 'Odisha' }],
        }),
      ),
      host('photon.komoot.io', undefined, () => jsonResponse({ features: [] })),
      host('nominatim.openstreetmap.org', undefined, () => jsonResponse([])),
    );
    // Open-Meteo also answers the first (name) lookup with the district entry, which fails the district check.
    const withDistrict = new OpenAreaGeocoder('test-agent', district.fetchImpl);
    expect(await withDistrict.locate({ ...query, name: 'Nowhere Special' })).toMatchObject({
      confidence: 'approximate',
      latitude: 20.18,
    });

    const none = stubFetch();
    expect(await new OpenAreaGeocoder('test-agent', none.fetchImpl).locate(query)).toBeNull();
  }, 20_000);

  it('caches resolved areas', async () => {
    const { fetchImpl } = stubFetch(
      host('geocoding-api.open-meteo.com', undefined, () =>
        jsonResponse({
          results: [
            {
              name: 'Sundarpada',
              latitude: 20.2,
              longitude: 85.8,
              admin1: 'Odisha',
              admin2: 'Khordha',
            },
          ],
        }),
      ),
    );
    const geocoder = new OpenAreaGeocoder('test-agent', fetchImpl);
    await geocoder.locate(query);
    await geocoder.locate(query);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('offline fixtures (development and tests only)', () => {
  it('lists post offices and locates them without the network', async () => {
    const offices = await new OfflinePincodeDirectory().lookup('400053');
    expect(offices.map((o) => o.name)).toEqual(['Andheri West', 'Versova']);
    expect(await new OfflinePincodeDirectory().lookup('999999')).toEqual([]);
    const area = await new OfflineAreaGeocoder().locate({
      pincode: '400053',
      name: 'Andheri West',
      district: 'Mumbai',
      state: 'Maharashtra',
    });
    expect(area).toMatchObject({ source: 'offline', confidence: 'high', latitude: 19.1364 });
    expect(
      await new OfflineAreaGeocoder().locate({
        pincode: '400053',
        name: 'Nope',
        district: 'x',
        state: 'y',
      }),
    ).toBeNull();
  });
});
