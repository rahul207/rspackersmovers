import { useEffect, useRef } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  SCENE_H,
  SCENE_W,
  bezierPoint,
  visualFor,
  type RouteMode,
  type SceneState,
  type VehicleVisual,
} from './route-geometry';
import type { VehicleType } from '@rs/shared';

export interface Scene3DProps {
  scene: SceneState;
  /** False while off-screen or the tab is hidden: the render loop is cancelled. */
  active: boolean;
  lowPower?: boolean;
  /** Called after the first frame has been drawn. */
  onReady: () => void;
  /** Called when WebGL cannot be used (creation failure or context loss). */
  onUnavailable: () => void;
}

const NAVY = '#0B1F3A';
const AMBER = '#F59E0B';
const ORANGE = '#F97316';
const GROUND = '#E2E8F0';
const SCALE = 20; // scene units per world unit
const ROAD_WIDTH = 1.7;
const PIN_MS = 350;
const PIN_SCALE = 1.15;
const IDLE_FRAME_MS = 50;
const DASH_SPACING = 1.1;
const DASH_SPEED = 0.25; // world units per second
const FIT_BOUNDS = { x: 9.6, zMin: -6.2, zMax: 4.6, height: 1.9 };

function toWorld(p: { x: number; y: number }, y = 0): Vector3 {
  return new Vector3((p.x - SCENE_W / 2) / SCALE, y, (p.y - SCENE_H / 2) / SCALE);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

interface Controller {
  update(scene: SceneState): void;
  setActive(active: boolean): void;
  dispose(): void;
}

interface ControllerOptions {
  container: HTMLElement;
  lowPower: boolean;
  onReady: () => void;
  onUnavailable: () => void;
}

function createController(opts: ControllerOptions): Controller | null {
  const { container, lowPower, onReady, onUnavailable } = opts;
  const dpr = window.devicePixelRatio || 1;
  const maxRatio = lowPower ? 1 : 1.5;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      antialias: dpr <= 1.5 && !lowPower,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch {
    onUnavailable();
    return null;
  }
  renderer.setPixelRatio(Math.min(dpr, maxRatio));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.setAttribute('tabindex', '-1');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  container.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 4 / 3, 0.1, 200);
  const target = new Vector3(0, 0, 1.2);
  const viewDir = new Vector3(-0.08, 0.78, 0.62).normalize();

  scene.add(new HemisphereLight('#FFFFFF', '#94A3B8', 1.5));
  const sun = new DirectionalLight('#FFF4DC', 1.9);
  sun.position.set(6, 12, 5);
  scene.add(sun);

  const materials = new Map<string, MeshLambertMaterial>();
  const mat = (color: string): MeshLambertMaterial => {
    let m = materials.get(color);
    if (!m) {
      m = new MeshLambertMaterial({ color, flatShading: true });
      materials.set(color, m);
    }
    return m;
  };

  const box = new BoxGeometry(1, 1, 1);
  const wheelGeo = new CylinderGeometry(1, 1, 1, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const coneGeo = new ConeGeometry(0.34, 0.9, 10);
  coneGeo.rotateX(Math.PI);
  const sphereGeo = new SphereGeometry(0.34, 12, 8);
  const groundGeo = new PlaneGeometry(90, 90);
  groundGeo.rotateX(-Math.PI / 2);

  const addBox = (
    parent: Object3D,
    color: string,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new Mesh(box, mat(color));
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const addWheel = (parent: Object3D, x: number, z: number, r: number) => {
    const m = new Mesh(wheelGeo, mat('#0F172A'));
    m.scale.set(r, r, 0.16);
    m.position.set(x, r, z);
    parent.add(m);
  };

  const ground = new Mesh(groundGeo, mat(GROUND));
  ground.position.y = -0.02;
  scene.add(ground);

  // Low-poly backdrop blocks outside the route area.
  const backdrop: Array<[number, number, number, number, number]> = [
    [-9.2, -5.6, 1.8, 1.6, 1.4],
    [-7.2, -6.4, 1.2, 1.0, 1.0],
    [9.4, 4.8, 1.8, 1.4, 1.8],
    [7.2, 6.2, 1.2, 0.8, 1.2],
    [0.5, 6.6, 1.4, 0.9, 1.0],
    [-2.6, -6.8, 1.0, 0.7, 1.0],
  ];
  for (const [x, z, w, h, d] of backdrop) addBox(scene, '#CBD5E1', w, h, d, x, h / 2, z);

  // Route-dependent objects.
  let roadMesh: Mesh | null = null;
  let curve: CatmullRomCurve3 | null = null;
  let curveLength = 1;
  let dashes: InstancedMesh | null = null;
  const dashGeo = new BoxGeometry(0.55, 0.03, 0.09);
  const dashDummy = new Object3D();

  const pickupPin = new Group();
  const pin = (head: Object3D) => {
    const cone = new Mesh(coneGeo, mat(AMBER));
    cone.position.y = 0.45;
    pickupPin.add(cone);
    head.position.y = 1.15;
    pickupPin.add(head);
  };
  pin(new Mesh(sphereGeo, mat(AMBER)));
  const dropPin = new Group();
  {
    const pole = new Mesh(box, mat(NAVY));
    pole.scale.set(0.08, 1.5, 0.08);
    pole.position.y = 0.75;
    const flag = new Mesh(box, mat(ORANGE));
    flag.scale.set(0.7, 0.45, 0.06);
    flag.position.set(0.38, 1.28, 0);
    const base = new Mesh(coneGeo, mat(ORANGE));
    base.scale.set(0.8, 0.35, 0.8);
    base.position.y = 0.16;
    dropPin.add(pole, flag, base);
  }
  pickupPin.visible = false;
  dropPin.visible = false;
  scene.add(pickupPin, dropPin);

  let vehicle: Group | null = null;
  let vehicleType: VehicleType | null = null;

  const buildVehicle = (v: VehicleVisual): Group => {
    const g = new Group();
    const { length: L, width: W, height: H } = v;
    if (v.icon === 'bike') {
      addWheel(g, L * 0.34, 0, 0.22);
      addWheel(g, -L * 0.34, 0, 0.22);
      addBox(g, v.cabColor, L * 0.62, 0.1, 0.1, 0, 0.42, 0);
      addBox(g, v.color, L * 0.3, 0.32, 0.4, -L * 0.36, 0.72, 0);
      addBox(g, NAVY, 0.2, 0.42, 0.26, L * 0.02, 0.74, 0);
      addBox(g, '#FFFFFF', 0.22, 0.22, 0.22, L * 0.06, 1.1, 0);
      addBox(g, '#E2E8F0', 0.06, 0.06, 0.5, L * 0.3, 0.78, 0);
    } else if (v.icon === 'three-wheeler') {
      addWheel(g, L * 0.36, 0, 0.26);
      addWheel(g, -L * 0.3, W * 0.4, 0.26);
      addWheel(g, -L * 0.3, -W * 0.4, 0.26);
      addBox(g, '#1E293B', L * 0.95, 0.1, W * 0.7, 0, 0.36, 0);
      addBox(g, v.color, L * 0.6, H * 0.8, W * 0.95, -L * 0.18, 0.4 + (H * 0.8) / 2, 0);
      addBox(g, v.cabColor, L * 0.3, H * 0.85, W * 0.85, L * 0.3, 0.4 + (H * 0.85) / 2, 0);
      addBox(g, '#E2E8F0', 0.04, H * 0.35, W * 0.6, L * 0.46, 0.4 + H * 0.62, 0);
    } else {
      const cabL = L * 0.28;
      const cargoL = L - cabL - 0.04;
      const cabH = H * 0.8;
      const cargoY = 0.42;
      addBox(g, '#1E293B', L, 0.12, W * 0.8, 0, 0.34, 0);
      if (v.icon === 'pickup') {
        addBox(g, v.color, cargoL, H * 0.35, W, -L / 2 + cargoL / 2, cargoY + (H * 0.35) / 2, 0);
        addBox(
          g,
          AMBER,
          cargoL * 0.35,
          H * 0.4,
          W * 0.6,
          -L / 2 + cargoL * 0.3,
          cargoY + H * 0.35 + (H * 0.4) / 2,
          0,
        );
      } else {
        addBox(g, v.color, cargoL, H, W, -L / 2 + cargoL / 2, cargoY + H / 2, 0);
      }
      addBox(g, v.cabColor, cabL, cabH, W * 0.96, L / 2 - cabL / 2, cargoY + cabH / 2, 0);
      addBox(g, '#E2E8F0', 0.04, cabH * 0.38, W * 0.72, L / 2 + 0.005, cargoY + cabH * 0.7, 0);
      const r = v.wheels === 6 ? 0.3 : 0.32;
      const zs = [W * 0.46, -W * 0.46];
      for (const z of zs) {
        addWheel(g, L / 2 - cabL * 0.45, z, r);
        addWheel(g, -L / 2 + cargoL * 0.2, z, r);
        if (v.wheels === 6) addWheel(g, -L / 2 + cargoL * 0.2 + 0.75, z, r);
      }
    }
    return g;
  };

  const buildRoad = (state: SceneState) => {
    if (roadMesh) {
      scene.remove(roadMesh);
      roadMesh.geometry.dispose();
      roadMesh = null;
    }
    if (dashes) {
      scene.remove(dashes);
      dashes.dispose();
      dashes = null;
    }
    const samples = 14;
    const pts: Vector3[] = [];
    for (let i = 0; i <= samples; i += 1)
      pts.push(toWorld(bezierPoint(state.shape, i / samples), 0.02));
    curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 120;
    curveLength = curve.getLength();

    const count = 72;
    const spaced = curve.getSpacedPoints(count);
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const tangent = new Vector3();
    for (let i = 0; i <= count; i += 1) {
      const p = spaced[i] as Vector3;
      const a = spaced[Math.max(0, i - 1)] as Vector3;
      const b = spaced[Math.min(count, i + 1)] as Vector3;
      tangent.subVectors(b, a).setY(0).normalize();
      const nx = -tangent.z;
      const nz = tangent.x;
      const hw = ROAD_WIDTH / 2;
      positions.push(p.x + nx * hw, 0.02, p.z + nz * hw, p.x - nx * hw, 0.02, p.z - nz * hw);
      normals.push(0, 1, 0, 0, 1, 0);
      if (i < count) {
        const l = i * 2;
        const r = l + 1;
        indices.push(r, l, r + 2, l, l + 2, r + 2);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    roadMesh = new Mesh(geo, mat(NAVY));
    scene.add(roadMesh);

    const dashCount = Math.ceil(curveLength / DASH_SPACING) + 1;
    dashes = new InstancedMesh(dashGeo, mat(AMBER), dashCount);
    scene.add(dashes);

    const placePin = (group: Group, t: number) => {
      const p = curve!.getPointAt(t);
      const tan = curve!.getTangentAt(t);
      let nx = -tan.z;
      let nz = tan.x;
      if (nz > 0) {
        nx = -nx;
        nz = -nz;
      }
      const len = Math.hypot(nx, nz) || 1;
      group.position.set(
        p.x + (nx / len) * (ROAD_WIDTH / 2 + 0.55),
        0,
        p.z + (nz / len) * (ROAD_WIDTH / 2 + 0.55),
      );
    };
    placePin(pickupPin, 0);
    placePin(dropPin, 1);
  };

  const fitCamera = (aspect: number) => {
    camera.aspect = aspect;
    const corners: Vector3[] = [];
    for (const x of [-FIT_BOUNDS.x, FIT_BOUNDS.x])
      for (const y of [0, FIT_BOUNDS.height])
        for (const z of [FIT_BOUNDS.zMin, FIT_BOUNDS.zMax]) corners.push(new Vector3(x, y, z));
    let dist = 34;
    const probe = new Vector3();
    for (let i = 0; i < 5; i += 1) {
      camera.position.copy(target).addScaledVector(viewDir, dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      let factor = 0;
      for (const c of corners) {
        probe.copy(c).project(camera);
        factor = Math.max(
          factor,
          Math.abs(probe.x) / 0.92,
          probe.y / 0.9,
          probe.y < 0 ? -probe.y / 0.68 : 0,
        );
      }
      dist *= Math.min(1.6, Math.max(0.6, factor || 1));
    }
    camera.position.copy(target).addScaledVector(viewDir, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    fitCamera(w / h);
    requestFrame();
  };

  // State
  let current: SceneState | null = null;
  let mode: RouteMode = 'idle';
  let pinElapsed = PIN_MS;
  let flow = 0;
  let active = false;
  let disposed = false;
  let raf = 0;
  let last: number | null = null;
  let lastRender = 0;
  let readyFired = false;
  const tmp = new Vector3();
  const tan = new Vector3();

  const placeVehicle = (u: number) => {
    if (!vehicle || !curve) return;
    curve.getPointAt(u, tmp);
    curve.getTangentAt(u, tan);
    vehicle.position.set(tmp.x, 0.02, tmp.z);
    vehicle.rotation.y = Math.atan2(-tan.z, tan.x);
  };

  const placeDashes = () => {
    if (!dashes || !curve) return;
    const n = dashes.count;
    for (let i = 0; i < n; i += 1) {
      const dist = (i * DASH_SPACING + flow) % (n * DASH_SPACING);
      const u = Math.min(1, dist / curveLength);
      curve.getPointAt(u, tmp);
      curve.getTangentAt(u, tan);
      dashDummy.position.set(tmp.x, 0.05, tmp.z);
      dashDummy.rotation.set(0, Math.atan2(-tan.z, tan.x), 0);
      dashDummy.scale.setScalar(dist > curveLength ? 0 : 1);
      dashDummy.updateMatrix();
      dashes.setMatrixAt(i, dashDummy.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed || !active) return;
    if (mode === 'idle' && last !== null && now - lastRender < IDLE_FRAME_MS) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = last === null ? 0 : Math.min(now - last, 100);
    last = now;
    lastRender = now;
    let animating = false;

    if (mode === 'idle') {
      flow += (dt / 1000) * DASH_SPEED;
      placeDashes();
      animating = true;
    } else {
      // The vehicle always waits at pickup; drop is shown as a marker only.
      placeVehicle(0);
    }

    if (pinElapsed < PIN_MS) {
      pinElapsed += dt;
      animating = true;
    }
    const s = Math.max(0.001, easeOutBack(pinElapsed / PIN_MS));
    pickupPin.scale.setScalar(s * PIN_SCALE);
    dropPin.scale.setScalar(s * PIN_SCALE);

    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      onReady();
    }
    if (animating) raf = requestAnimationFrame(tick);
  };

  function requestFrame() {
    if (disposed || !active || raf) return;
    last = null;
    raf = requestAnimationFrame(tick);
  }

  const onContextLost = (event: Event) => {
    event.preventDefault();
    onUnavailable();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  ro?.observe(container);
  fitCamera(Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight));
  renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);

  return {
    update(next) {
      const prev = current;
      current = next;
      if (!prev || prev.shape !== next.shape) buildRoad(next);
      if (vehicleType !== next.vehicleType) {
        if (vehicle) scene.remove(vehicle);
        vehicle = buildVehicle(visualFor(next.vehicleType));
        vehicleType = next.vehicleType;
        scene.add(vehicle);
      }
      mode = next.mode;
      if (!prev || prev.signature !== next.signature) {
        pinElapsed = 0;
      }
      pickupPin.visible = mode !== 'idle';
      dropPin.visible = mode === 'route';
      if (vehicle) vehicle.visible = mode !== 'idle';
      if (mode === 'idle') placeDashes();
      else {
        flow = 0;
        placeDashes();
      }
      requestFrame();
    },
    setActive(next) {
      if (active === next) return;
      active = next;
      if (active) requestFrame();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set<BufferGeometry>([
        box,
        wheelGeo,
        coneGeo,
        sphereGeo,
        groundGeo,
        dashGeo,
      ]);
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) geometries.add(m.geometry);
      });
      geometries.forEach((g) => g.dispose());
      dashes?.dispose();
      materials.forEach((m: Material) => m.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

export default function Scene3D({
  scene,
  active,
  lowPower = false,
  onReady,
  onUnavailable,
}: Scene3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const callbacks = useRef({ onReady, onUnavailable });
  const latest = useRef({ scene, active });

  // Declared before the init effect so refs are current when it runs.
  useEffect(() => {
    callbacks.current = { onReady, onUnavailable };
    latest.current = { scene, active };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const controller = createController({
      container: host,
      lowPower,
      onReady: () => callbacks.current.onReady(),
      onUnavailable: () => callbacks.current.onUnavailable(),
    });
    controllerRef.current = controller;
    if (!controller) return undefined;
    controller.update(latest.current.scene);
    controller.setActive(latest.current.active);
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, [lowPower]);

  useEffect(() => {
    controllerRef.current?.update(scene);
  }, [scene]);

  useEffect(() => {
    controllerRef.current?.setActive(active);
  }, [active]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="absolute inset-0"
      style={{ pointerEvents: 'none' }}
    />
  );
}
