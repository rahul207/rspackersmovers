import type { AreaGeocoder } from '@rs/application';
import type { AreaQuery, LocationConfidence, ResolvedArea } from '@rs/shared';
import { TtlCache, createThrottle, fetchJsonOrNull } from './http-utils';

const CACHE_TTL_MS = 24 * 60 * 60_000;
const INDIA_BBOX = '68.1,6.5,97.4,35.7';
/** Nominatim's usage policy: at most one request per second. */
const NOMINATIM_MIN_INTERVAL_MS = 1100;

/* ---------- name matching helpers (exported for tests) ---------- */

/** Letters only, lower-case, "&" -> "and". */
export const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .normalize('NFKD')
    .replace(/[^a-z]/g, '');

const STATE_ALIASES: Record<string, string> = {
  orissa: 'odisha',
  nctofdelhi: 'delhi',
  newdelhi: 'delhi',
  uttaranchal: 'uttarakhand',
  pondicherry: 'puducherry',
  andamanandnicobarislands: 'andamanandnicobar',
  jammuandkashmir: 'jammuandkashmir',
};

const canonicalState = (value: string): string => {
  const n = normalizeName(value);
  return STATE_ALIASES[n] ?? n;
};

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = prev[j] ?? 0;
      prev[j] = Math.min(
        above + 1,
        (prev[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length] ?? 0;
}

/** Tolerates spelling variants such as India Post "Khorda" vs OpenStreetMap "Khordha". */
export function sameName(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return true;
  const allowed = Math.max(x.length, y.length) >= 6 ? 2 : 1;
  return editDistance(x, y) <= allowed;
}

export function sameState(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = canonicalState(a);
  const y = canonicalState(b);
  return (
    !!x &&
    !!y &&
    (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))))
  );
}

/**
 * India Post names often carry office-type suffixes or a disambiguating district in brackets,
 * e.g. "Old Town (Khorda)", "Bhimatangi ND", "Pune GPO". Strip those so the place can be found.
 */
export function cleanAreaName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:g\.?p\.?o|h\.?o|s\.?o|b\.?o|p\.?o|n\.?d)\.?\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- upstream response shapes ---------- */

interface OpenMeteoPlace {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin2?: string;
  admin3?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    state?: string;
    district?: string;
    county?: string;
    city?: string;
    postcode?: string;
  };
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    state?: string;
    state_district?: string;
    county?: string;
    city?: string;
    town?: string;
    postcode?: string;
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const finite = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' &&
  Number.isFinite(lat) &&
  typeof lon === 'number' &&
  Number.isFinite(lon);

/**
 * Finds where a post-office area is, using only free, keyless open sources, most precise first:
 *
 *   1. Open-Meteo / GeoNames - the named place, only if its district and state match.
 *   2. Photon (OpenStreetMap) - the named place, only if the PIN code or district matches.
 *   3. Nominatim (OpenStreetMap) - same check, throttled to 1 request/second.
 *   4. Nominatim by PIN code  - the centre of the whole PIN code area.      (approximate)
 *   5. Open-Meteo by district - the district centre.                        (approximate)
 *
 * Matching the district/state/PIN stops a same-named village elsewhere in India from being used.
 * Every source failure is swallowed so the next one is tried; null means none could place it.
 */
export class OpenAreaGeocoder implements AreaGeocoder {
  private readonly cache = new TtlCache<ResolvedArea>(CACHE_TTL_MS);
  private readonly throttleNominatim = createThrottle(NOMINATIM_MIN_INTERVAL_MS);

  constructor(
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async locate(query: AreaQuery, signal?: AbortSignal): Promise<ResolvedArea | null> {
    const key = `${query.pincode}|${query.name}|${query.district}|${query.state}`.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;
    const area = await this.resolve(query, signal);
    if (area) this.cache.set(key, area);
    return area;
  }

  private async resolve(q: AreaQuery, signal?: AbortSignal): Promise<ResolvedArea | null> {
    const name = cleanAreaName(q.name) || q.name;
    const make = (
      latitude: number,
      longitude: number,
      confidence: LocationConfidence,
      source: ResolvedArea['source'],
    ): ResolvedArea => ({
      pincode: q.pincode,
      name: q.name,
      district: q.district,
      state: q.state,
      areaLabel: `${q.name}, ${q.district}, ${q.state} - ${q.pincode}`,
      latitude: round6(latitude),
      longitude: round6(longitude),
      confidence,
      source,
    });
    const inDistrict = (...parts: (string | undefined)[]) =>
      parts.some((p) => sameName(p, q.district));

    // 1. Open-Meteo place search.
    const places = await this.openMeteo(name, signal);
    const place = places.find(
      (p) => sameState(p.admin1, q.state) && inDistrict(p.admin2, p.admin3),
    );
    if (place) return make(place.latitude, place.longitude, 'high', 'open-meteo');
    if (signal?.aborted) return null;

    // 2. Photon.
    for (const f of await this.photon(`${name}, ${q.district}, ${q.state}`, signal)) {
      const p = f.properties;
      const coords = f.geometry?.coordinates;
      if (!p || !coords || !sameState(p.state, q.state)) continue;
      const [lon, lat] = coords;
      if (!finite(lat, lon)) continue;
      const samePin = p.postcode?.replace(/\s/g, '') === q.pincode;
      if (samePin || inDistrict(p.district, p.county, p.city)) {
        return make(lat, lon, samePin ? 'high' : 'medium', 'photon');
      }
    }
    if (signal?.aborted) return null;

    // 3. Nominatim place search.
    for (const n of await this.nominatim({ q: `${name}, ${q.district}, ${q.state}` }, signal)) {
      const a = n.address;
      const lat = Number(n.lat);
      const lon = Number(n.lon);
      if (!a || !finite(lat, lon) || !sameState(a.state, q.state)) continue;
      const samePin = a.postcode?.replace(/\s/g, '') === q.pincode;
      if (samePin || inDistrict(a.state_district, a.county, a.city, a.town)) {
        return make(lat, lon, 'medium', 'nominatim');
      }
    }
    if (signal?.aborted) return null;

    // 4. Centre of the PIN code area.
    for (const n of await this.nominatim({ postalcode: q.pincode }, signal)) {
      const lat = Number(n.lat);
      const lon = Number(n.lon);
      if (finite(lat, lon) && sameState(n.address?.state ?? n.display_name, q.state)) {
        return make(lat, lon, 'approximate', 'nominatim');
      }
    }
    if (signal?.aborted) return null;

    // 5. District centre.
    const district = (await this.openMeteo(q.district, signal)).find((p) =>
      sameState(p.admin1, q.state),
    );
    return district
      ? make(district.latitude, district.longitude, 'approximate', 'open-meteo')
      : null;
  }

  private async openMeteo(name: string, signal?: AbortSignal): Promise<OpenMeteoPlace[]> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
      name,
      count: '10',
      language: 'en',
      format: 'json',
      countryCode: 'IN',
    })}`;
    const body = await fetchJsonOrNull<{ results?: OpenMeteoPlace[] }>(url, {
      signal,
      fetchImpl: this.fetchImpl,
    });
    return (body?.results ?? []).filter((p) => finite(p.latitude, p.longitude));
  }

  private async photon(query: string, signal?: AbortSignal): Promise<PhotonFeature[]> {
    const url = `https://photon.komoot.io/api/?${new URLSearchParams({
      q: query,
      bbox: INDIA_BBOX,
      limit: '8',
      lang: 'en',
    })}`;
    const body = await fetchJsonOrNull<{ features?: PhotonFeature[] }>(url, {
      headers: { 'user-agent': this.userAgent },
      signal,
      fetchImpl: this.fetchImpl,
    });
    return body?.features ?? [];
  }

  private nominatim(
    params: { q: string } | { postalcode: string },
    signal?: AbortSignal,
  ): Promise<NominatimPlace[]> {
    return this.throttleNominatim(async () => {
      const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        ...params,
        countrycodes: 'in',
        format: 'jsonv2',
        addressdetails: '1',
        limit: '5',
      })}`;
      const body = await fetchJsonOrNull<NominatimPlace[]>(url, {
        headers: { 'user-agent': this.userAgent },
        signal,
        fetchImpl: this.fetchImpl,
      });
      return Array.isArray(body) ? body : [];
    });
  }
}
