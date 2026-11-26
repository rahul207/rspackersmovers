import { VEHICLE_TYPE_LABELS, type VehicleType } from '@rs/shared';

/** Pure helpers shared by the SVG and three.js layers. Nothing here touches the DOM. */

export const SCENE_W = 400;
export const SCENE_H = 300;
export const ROUTE_DURATION_MS = 3500;
export const ILLUSTRATION_LABEL = 'Illustration only — not a driving route';
export const IDLE_CAPTION = 'Choose pickup and drop locations to preview your route';
export const DEFAULT_VEHICLE: VehicleType = 'TATA_ACE';
export const MAX_ADDRESS_LENGTH = 30;

export interface Pt {
  x: number;
  y: number;
}

export interface Coord {
  latitude: number;
  longitude: number;
}

/** Cubic bezier in scene units (400x300, y down). */
export interface RouteShape {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
}

export type RouteMode = 'idle' | 'pickup' | 'route';

export interface SceneState {
  mode: RouteMode;
  shape: RouteShape;
  vehicleType: VehicleType;
  /** Opaque change token (derived from coordinates); never render it into the DOM. */
  signature: string;
}

export const DEFAULT_SHAPE: RouteShape = {
  p0: { x: 18, y: 208 },
  p1: { x: 132, y: 84 },
  p2: { x: 266, y: 234 },
  p3: { x: 382, y: 70 },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Eased 0..1 progress for the given elapsed time. */
export function routeProgress(elapsedMs: number, durationMs: number = ROUTE_DURATION_MS): number {
  if (durationMs <= 0) return 1;
  return easeInOutCubic(elapsedMs / durationMs);
}

export function isValidCoord(c: Coord | null | undefined): c is Coord {
  return !!c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude);
}

/** FNV-1a over coordinates rounded to ~1 m, so identical inputs give identical curves. */
export function hashSeed(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    const s = Math.round(v * 1e5).toString();
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2c;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic value in [0,1) derived from a seed and a salt. */
export function seedUnit(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

/**
 * Illustrative curve only. The start depends solely on the pickup and the end solely on the
 * drop (so pins never jump when the other end is chosen); the bulge depends on both. The road
 * runs the full width of the scene so it reaches both edges of its container.
 */
export function buildRouteShape(pickup?: Coord | null, drop?: Coord | null): RouteShape {
  const p = isValidCoord(pickup) ? pickup : null;
  const d = isValidCoord(drop) ? drop : null;
  const startSeed = p ? hashSeed(p.latitude, p.longitude) : 0;
  const endSeed = d ? hashSeed(d.latitude, d.longitude) : 0;
  const p0: Pt = p
    ? { x: 14 + seedUnit(startSeed, 1) * 24, y: 178 + seedUnit(startSeed, 2) * 44 }
    : DEFAULT_SHAPE.p0;
  const p3: Pt = d
    ? { x: 360 + seedUnit(endSeed, 3) * 26, y: 56 + seedUnit(endSeed, 4) * 44 }
    : DEFAULT_SHAPE.p3;
  if (!p && !d) return DEFAULT_SHAPE;

  const pairSeed =
    p && d ? hashSeed(p.latitude, p.longitude, d.latitude, d.longitude) : startSeed ^ endSeed;
  const bearingSign = p && d && d.longitude < p.longitude ? -1 : 1;
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bulge1 = (34 + seedUnit(pairSeed, 5) * 58) * bearingSign;
  const bulge2 = -(30 + seedUnit(pairSeed, 6) * 58) * bearingSign;
  return {
    p0,
    p1: { x: p0.x + dx * 0.3 + nx * bulge1, y: p0.y + dy * 0.3 + ny * bulge1 },
    p2: { x: p0.x + dx * 0.7 + nx * bulge2, y: p0.y + dy * 0.7 + ny * bulge2 },
    p3,
  };
}

export function deriveSceneState(
  pickup: Coord | null | undefined,
  drop: Coord | null | undefined,
  vehicleType: VehicleType = DEFAULT_VEHICLE,
): SceneState {
  const p = isValidCoord(pickup) ? pickup : null;
  const d = p && isValidCoord(drop) ? drop : null;
  const mode: RouteMode = p ? (d ? 'route' : 'pickup') : 'idle';
  const shape = buildRouteShape(p, d);
  const signature = [
    mode,
    vehicleType,
    p ? `${p.latitude.toFixed(5)}:${p.longitude.toFixed(5)}` : '-',
    d ? `${d.latitude.toFixed(5)}:${d.longitude.toFixed(5)}` : '-',
  ].join('|');
  return { mode, shape, vehicleType, signature };
}

export function bezierPoint(s: RouteShape, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x,
    y: a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y,
  };
}

export function bezierTangent(s: RouteShape, t: number): Pt {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  return {
    x: a * (s.p1.x - s.p0.x) + b * (s.p2.x - s.p1.x) + c * (s.p3.x - s.p2.x),
    y: a * (s.p1.y - s.p0.y) + b * (s.p2.y - s.p1.y) + c * (s.p3.y - s.p2.y),
  };
}

export function shapePath(s: RouteShape): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(s.p0.x)} ${f(s.p0.y)} C${f(s.p1.x)} ${f(s.p1.y)} ${f(s.p2.x)} ${f(s.p2.y)} ${f(s.p3.x)} ${f(s.p3.y)}`;
}

export interface RouteSample extends Pt {
  /** Direction of travel in radians (scene space, y down). */
  angle: number;
}

export interface RouteSampler {
  length: number;
  /** u in 0..1 by arc length, so speed is even along the curve. */
  at(u: number): RouteSample;
}

export function createRouteSampler(shape: RouteShape, steps = 64): RouteSampler {
  const ts: number[] = [0];
  const lengths: number[] = [0];
  let prev = bezierPoint(shape, 0);
  let total = 0;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const p = bezierPoint(shape, t);
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    ts.push(t);
    lengths.push(total);
    prev = p;
  }
  return {
    length: total,
    at(u: number): RouteSample {
      const target = clamp01(u) * total;
      let lo = 0;
      let hi = steps;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if ((lengths[mid] ?? 0) <= target) lo = mid;
        else hi = mid;
      }
      const l0 = lengths[lo] ?? 0;
      const l1 = lengths[hi] ?? l0;
      const frac = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
      const t = lerp(ts[lo] ?? 0, ts[hi] ?? 1, frac);
      const p = bezierPoint(shape, t);
      const tan = bezierTangent(shape, t);
      return { x: p.x, y: p.y, angle: Math.atan2(tan.y, tan.x) };
    },
  };
}

/* ---------- Text helpers (addresses only, never coordinates) ---------- */

const COORD_ONLY = /^\s*[-+]?\d{1,3}(?:\.\d+)?\s*[,;/\s]\s*[-+]?\d{1,3}(?:\.\d+)?\s*$/;
const LONG_DECIMAL = /[-+]?\d{1,3}\.\d{4,}/g;
const FALLBACK_PLACE = 'selected location';

/** Strips anything that looks like raw coordinates out of a human-readable address. */
export function safeAddress(address: string | null | undefined): string {
  const raw = (address ?? '').replace(/\s+/g, ' ').trim();
  if (!raw || COORD_ONLY.test(raw)) return FALLBACK_PLACE;
  const cleaned = raw
    .replace(LONG_DECIMAL, '')
    .replace(/\s+([,;])/g, '$1')
    .replace(/[,;\s]+$/g, '')
    .trim();
  return cleaned && !COORD_ONLY.test(cleaned) ? cleaned : FALLBACK_PLACE;
}

export function truncateAddress(
  address: string | null | undefined,
  max: number = MAX_ADDRESS_LENGTH,
): string {
  const safe = safeAddress(address);
  const limit = Math.max(2, Math.floor(max));
  const chars = Array.from(safe);
  if (chars.length <= limit) return safe;
  return `${chars
    .slice(0, limit - 1)
    .join('')
    .trimEnd()}…`;
}

export interface CaptionLocation {
  address: string;
}

export function buildCaption(
  pickup?: CaptionLocation | null,
  drop?: CaptionLocation | null,
  max: number = MAX_ADDRESS_LENGTH,
): string {
  if (!pickup) return IDLE_CAPTION;
  const from = truncateAddress(pickup.address, max);
  if (!drop) return `Pickup selected: ${from}. Choose a drop location.`;
  return `${from} → ${truncateAddress(drop.address, max)}`;
}

export function vehicleLabel(vehicleType: VehicleType): string {
  return VEHICLE_TYPE_LABELS[vehicleType];
}

export function buildStatus(mode: RouteMode, vehicleType: VehicleType): string {
  const vehicle = `Vehicle: ${vehicleLabel(vehicleType)}.`;
  if (mode === 'idle') return 'Route preview is waiting for pickup and drop locations.';
  if (mode === 'pickup') return `Pickup pin placed. ${vehicle}`;
  return `Drop-off pin added. The vehicle waits at pickup until confirmed. ${vehicle}`;
}

export function buildAriaLabel(mode: RouteMode, vehicleType: VehicleType): string {
  const vehicle = vehicleLabel(vehicleType);
  if (mode === 'idle') return 'Decorative illustration of an empty road. Not a driving route.';
  if (mode === 'pickup')
    return `Illustration of a ${vehicle} at the pickup point. Not a driving route.`;
  return `Illustration of a ${vehicle} standing by at the pickup point, with the drop-off marked further along the road. Not a driving route.`;
}

/* ---------- Vehicle visual spec ---------- */

export type VehicleIcon =
  'bike' | 'three-wheeler' | 'mini-truck' | 'pickup' | 'truck' | 'container';

export interface VehicleVisual {
  /** 3D size in world units (length along travel direction). */
  length: number;
  width: number;
  height: number;
  /** Cargo / body colour. */
  color: string;
  cabColor: string;
  wheels: 2 | 3 | 4 | 6;
  icon: VehicleIcon;
  /** Length of the SVG icon in scene units. */
  svgLength: number;
}

export const VEHICLE_VISUALS: Record<VehicleType, VehicleVisual> = {
  TWO_WHEELER: {
    length: 1.1,
    width: 0.35,
    height: 0.7,
    color: '#F59E0B',
    cabColor: '#F97316',
    wheels: 2,
    icon: 'bike',
    svgLength: 30,
  },
  THREE_WHEELER: {
    length: 1.5,
    width: 0.7,
    height: 0.9,
    color: '#F97316',
    cabColor: '#F59E0B',
    wheels: 3,
    icon: 'three-wheeler',
    svgLength: 36,
  },
  TATA_ACE: {
    length: 1.9,
    width: 0.85,
    height: 0.95,
    color: '#FFFFFF',
    cabColor: '#F59E0B',
    wheels: 4,
    icon: 'mini-truck',
    svgLength: 42,
  },
  PICKUP_TRUCK: {
    length: 2.1,
    width: 0.9,
    height: 0.95,
    color: '#F8FAFC',
    cabColor: '#F97316',
    wheels: 4,
    icon: 'pickup',
    svgLength: 46,
  },
  TRUCK_14FT: {
    length: 2.5,
    width: 1.0,
    height: 1.2,
    color: '#FFFFFF',
    cabColor: '#F59E0B',
    wheels: 4,
    icon: 'truck',
    svgLength: 52,
  },
  TRUCK_17FT: {
    length: 2.9,
    width: 1.05,
    height: 1.3,
    color: '#F8FAFC',
    cabColor: '#F97316',
    wheels: 6,
    icon: 'truck',
    svgLength: 58,
  },
  TRUCK_20FT: {
    length: 3.3,
    width: 1.1,
    height: 1.4,
    color: '#FFFFFF',
    cabColor: '#F59E0B',
    wheels: 6,
    icon: 'truck',
    svgLength: 64,
  },
  CONTAINER_TRUCK: {
    length: 3.8,
    width: 1.15,
    height: 1.55,
    color: '#F59E0B',
    cabColor: '#F97316',
    wheels: 6,
    icon: 'container',
    svgLength: 74,
  },
};

export function visualFor(vehicleType: VehicleType | undefined): VehicleVisual {
  return VEHICLE_VISUALS[vehicleType ?? DEFAULT_VEHICLE];
}
