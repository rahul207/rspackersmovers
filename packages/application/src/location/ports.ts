import type { AreaQuery, PostOfficeEntry, ResolvedArea } from '@rs/shared';

/** Looks up the post offices (area names) that share a PIN code. */
export interface PincodeDirectory {
  /** Returns an empty list when the PIN code is unknown. Throws ApplicationError when the source is down. */
  lookup(pincode: string, signal?: AbortSignal): Promise<PostOfficeEntry[]>;
}

/** Finds the coordinates of an area (a post office of a PIN code) from open geocoding sources. */
export interface AreaGeocoder {
  /** Returns null when no source could place the area. */
  locate(query: AreaQuery, signal?: AbortSignal): Promise<ResolvedArea | null>;
}
