import { estimateRoadDistanceKm, type LocationConfidence } from '@rs/shared';

/** Typical road-to-straight-line ratio used to turn a straight-line distance into an approximate road distance. */
export const ROAD_DISTANCE_FACTOR = 1.3;

/**
 * A pickup/drop place. The area (post office, district, state, PIN) comes from the India Post
 * directory, the coordinates are the centre of that area, and `streetAddress` is typed by the
 * customer. `address` is the combined human-readable line.
 */
export interface Location {
  address: string;
  latitude: number;
  longitude: number;
  pincode?: string | undefined;
  area?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  streetAddress?: string | undefined;
  confidence?: LocationConfidence | undefined;
}

/**
 * Approximate road distance between two area centres. Because coordinates are area-level this
 * is only indicative and must always be presented as approximate.
 */
export function estimateDistanceKm(pickup: Location, drop: Location): number {
  return estimateRoadDistanceKm(pickup, drop, ROAD_DISTANCE_FACTOR);
}
