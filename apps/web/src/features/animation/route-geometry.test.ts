import { VEHICLE_TYPES } from '@rs/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHAPE,
  IDLE_CAPTION,
  SCENE_H,
  SCENE_W,
  VEHICLE_VISUALS,
  buildAriaLabel,
  buildCaption,
  buildRouteShape,
  buildStatus,
  createRouteSampler,
  deriveSceneState,
  easeInOutCubic,
  routeProgress,
  safeAddress,
  truncateAddress,
} from './route-geometry';

const pickup = { latitude: 12.971598, longitude: 77.594566, address: 'MG Road, Bengaluru' };
const drop = { latitude: 13.08268, longitude: 80.270721, address: 'T Nagar, Chennai' };

describe('buildRouteShape', () => {
  it('is deterministic for identical coordinates', () => {
    expect(buildRouteShape(pickup, drop)).toEqual(buildRouteShape({ ...pickup }, { ...drop }));
  });

  it('differs for different routes', () => {
    const other = buildRouteShape(pickup, { latitude: 19.076, longitude: 72.8777 });
    expect(other).not.toEqual(buildRouteShape(pickup, drop));
  });

  it('keeps the start independent of the drop and stays within the scene', () => {
    const a = buildRouteShape(pickup, null);
    const b = buildRouteShape(pickup, drop);
    expect(a.p0).toEqual(b.p0);
    for (const pt of [b.p0, b.p3]) {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.x).toBeLessThan(SCENE_W);
      expect(pt.y).toBeGreaterThan(0);
      expect(pt.y).toBeLessThan(SCENE_H);
    }
  });

  it('falls back to the default road with no or invalid input', () => {
    expect(buildRouteShape(null, null)).toBe(DEFAULT_SHAPE);
    expect(buildRouteShape({ latitude: Number.NaN, longitude: 1 }, null)).toBe(DEFAULT_SHAPE);
  });
});

describe('deriveSceneState', () => {
  it('derives mode and a coordinate-based signature', () => {
    expect(deriveSceneState(null, drop).mode).toBe('idle');
    expect(deriveSceneState(pickup, null).mode).toBe('pickup');
    const both = deriveSceneState(pickup, drop, 'TRUCK_17FT');
    expect(both.mode).toBe('route');
    expect(both.signature).toBe(
      deriveSceneState({ ...pickup }, { ...drop }, 'TRUCK_17FT').signature,
    );
    expect(both.signature).not.toBe(deriveSceneState(pickup, drop, 'TRUCK_20FT').signature);
  });
});

describe('easing and progress', () => {
  it('stays within 0..1, is monotonic and clamps out-of-range input', () => {
    let prev = -1;
    for (let i = -5; i <= 105; i += 1) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(routeProgress(0)).toBe(0);
    expect(routeProgress(99999)).toBe(1);
  });
});

describe('createRouteSampler', () => {
  it('starts at the pickup end and finishes at the drop end', () => {
    const shape = buildRouteShape(pickup, drop);
    const sampler = createRouteSampler(shape);
    const start = sampler.at(0);
    const end = sampler.at(1);
    expect(start.x).toBeCloseTo(shape.p0.x, 3);
    expect(start.y).toBeCloseTo(shape.p0.y, 3);
    expect(end.x).toBeCloseTo(shape.p3.x, 3);
    expect(end.y).toBeCloseTo(shape.p3.y, 3);
    expect(sampler.length).toBeGreaterThan(0);
  });
});

describe('captions', () => {
  it('truncates long addresses with an ellipsis and keeps short ones', () => {
    expect(truncateAddress('Short')).toBe('Short');
    const long = truncateAddress(
      'A very long address line, Some Locality, Some City, Some State',
      20,
    );
    expect(Array.from(long)).toHaveLength(20);
    expect(long.endsWith('…')).toBe(true);
  });

  it('builds the three caption states', () => {
    expect(buildCaption(null, null)).toBe(IDLE_CAPTION);
    expect(buildCaption(pickup, null)).toBe(
      'Pickup selected: MG Road, Bengaluru. Choose a drop location.',
    );
    expect(buildCaption(pickup, drop)).toBe('MG Road, Bengaluru → T Nagar, Chennai');
  });

  it('never leaks coordinates into any text', () => {
    const leaky = {
      latitude: 12.971598,
      longitude: 77.594566,
      address: '12.971598, 77.594566',
    };
    const mixed = { ...drop, address: 'Near 13.08268 80.270721 T Nagar' };
    const texts = [
      buildCaption(leaky, mixed),
      buildCaption(leaky, null),
      buildStatus('route', 'TATA_ACE'),
      buildAriaLabel('route', 'TATA_ACE'),
      safeAddress(leaky.address),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\d{1,3}\.\d{3,}/);
      expect(text).not.toContain('12.97');
      expect(text).not.toContain('77.59');
    }
  });
});

describe('vehicle visuals', () => {
  it('orders vehicle lengths from smallest to longest', () => {
    const lengths = VEHICLE_TYPES.map((t) => VEHICLE_VISUALS[t].length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(VEHICLE_VISUALS.CONTAINER_TRUCK.length).toBe(Math.max(...lengths));
  });
});
