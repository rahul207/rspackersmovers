import { ApplicationError, type PincodeDirectory } from '@rs/application';
import { PINCODE_PATTERN, type PostOfficeEntry } from '@rs/shared';
import { TtlCache, fetchJsonOrNull } from './http-utils';

interface IndiaPostOffice {
  Name?: string;
  BranchType?: string;
  DeliveryStatus?: string;
  Block?: string;
  District?: string;
  State?: string;
  Pincode?: string;
}

interface IndiaPostResponse {
  Status?: string;
  Message?: string;
  PostOffice?: IndiaPostOffice[] | null;
}

const BASE_URL = 'https://api.postalpincode.in';
const CACHE_TTL_MS = 6 * 60 * 60_000; // PIN code data changes rarely
const ATTEMPTS = 2; // the public API occasionally drops a request

const clean = (value: string | undefined): string | undefined => {
  const v = value?.replace(/\s+/g, ' ').trim();
  return v && v.toUpperCase() !== 'NA' ? v : undefined;
};

/**
 * India Post PIN code directory (https://api.postalpincode.in, free, no key).
 * One PIN code maps to several post offices; each is an "area name" the customer can pick.
 */
export class IndiaPostPincodeDirectory implements PincodeDirectory {
  private readonly cache = new TtlCache<PostOfficeEntry[]>(CACHE_TTL_MS);

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async lookup(pincode: string, signal?: AbortSignal): Promise<PostOfficeEntry[]> {
    if (!PINCODE_PATTERN.test(pincode)) return [];
    const cached = this.cache.get(pincode);
    if (cached) return cached;

    let body: IndiaPostResponse[] | null = null;
    for (let attempt = 0; attempt < ATTEMPTS && body === null; attempt += 1) {
      if (signal?.aborted) break;
      body = await fetchJsonOrNull<IndiaPostResponse[]>(`${BASE_URL}/pincode/${pincode}`, {
        signal,
        fetchImpl: this.fetchImpl,
      });
    }
    const first = Array.isArray(body) ? body[0] : undefined;
    if (!first) {
      throw new ApplicationError(
        'UPSTREAM_UNAVAILABLE',
        'The PIN code directory is not responding right now. Please try again in a moment.',
      );
    }

    const offices = (first.PostOffice ?? [])
      .map((o): PostOfficeEntry | null => {
        const name = clean(o.Name);
        const district = clean(o.District);
        const state = clean(o.State);
        if (!name || !district || !state) return null;
        const block = clean(o.Block);
        const branchType = clean(o.BranchType);
        const deliveryStatus = clean(o.DeliveryStatus);
        return {
          id: `${pincode}:${name}`,
          name,
          pincode: clean(o.Pincode) ?? pincode,
          ...(branchType ? { branchType } : {}),
          ...(deliveryStatus ? { deliveryStatus } : {}),
          ...(block ? { block } : {}),
          district,
          state,
        };
      })
      .filter((o): o is PostOfficeEntry => o !== null);

    const byId = new Map<string, PostOfficeEntry>();
    for (const o of offices) if (!byId.has(o.id)) byId.set(o.id, o);
    const unique = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    this.cache.set(pincode, unique);
    return unique;
  }
}
