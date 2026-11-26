const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two WGS84 points in kilometres. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line distance scaled by a road factor and rounded to one decimal place. */
export function estimateRoadDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  roadFactor: number,
): number {
  return Math.round(haversineKm(a, b) * roadFactor * 10) / 10;
}
