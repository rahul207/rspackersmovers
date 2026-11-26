import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  SCENE_H,
  SCENE_W,
  clamp,
  createRouteSampler,
  shapePath,
  visualFor,
  type SceneState,
  type VehicleVisual,
} from './route-geometry';

export interface RouteSvgSceneProps {
  scene: SceneState;
  /** False when reduced motion is requested: final state is drawn statically. */
  animate: boolean;
  /** False while off-screen / tab hidden / replaced by the 3D layer: no frames are scheduled. */
  active: boolean;
  /** Visually hides the scene (3D layer on top) while keeping it available to assistive tech. */
  covered: boolean;
  ariaLabel: string;
}

const NAVY = '#0B1F3A';
const AMBER = '#F59E0B';
const ORANGE = '#F97316';
const TYRE = '#1E293B';
const PIN_LIFT = 14; // pins sit on the road edge so the vehicle never hides them
const VEHICLE_SCALE = 1.25;
const FLOW_SPEED = 5; // scene units per second: deliberately slow
const FLOW_INTERVAL_MS = 50;

function Wheel({ x, r = 5 }: { x: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={-r} r={r} fill={TYRE} stroke="#E2E8F0" strokeWidth={1} />
      <circle cx={x} cy={-r} r={r * 0.35} fill="#CBD5E1" />
    </g>
  );
}

function BikeIcon({ v }: { v: VehicleVisual }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <rect
        x={-15}
        y={-21}
        width={10}
        height={9}
        rx={1.5}
        fill={v.color}
        stroke={NAVY}
        strokeWidth={0.8}
      />
      <path d="M-10 -5 L-3 -12 L7 -12 L10 -5" fill="none" stroke={v.cabColor} strokeWidth={2.2} />
      <path d="M7 -12 L8 -18 L12 -18" fill="none" stroke="#E2E8F0" strokeWidth={1.6} />
      <path d="M-3 -13 L2 -22" stroke="#FFFFFF" strokeWidth={3.2} />
      <circle cx={3} cy={-25} r={3} fill="#FFFFFF" stroke={NAVY} strokeWidth={0.8} />
      <Wheel x={-10} />
      <Wheel x={10} />
    </g>
  );
}

function ThreeWheelerIcon({ v }: { v: VehicleVisual }) {
  return (
    <g strokeLinejoin="round">
      <rect
        x={-18}
        y={-23}
        width={21}
        height={16}
        rx={1.5}
        fill={v.color}
        stroke={NAVY}
        strokeWidth={0.8}
      />
      <path
        d="M3 -7 L3 -22 L11 -22 L18 -13 L18 -7 Z"
        fill={v.cabColor}
        stroke={NAVY}
        strokeWidth={0.8}
      />
      <path d="M6 -19.5 L10 -19.5 L14.5 -13.5 L6 -13.5 Z" fill="#E2E8F0" />
      <Wheel x={-10} />
      <Wheel x={13} />
    </g>
  );
}

function TruckIcon({ v }: { v: VehicleVisual }) {
  const L = v.svgLength;
  const x0 = -L / 2;
  const cabW = L * 0.27;
  const cargoW = L - cabW - 1;
  const cargoH = L * 0.36;
  const cabH = cargoH * 0.78;
  const cx = x0 + cargoW + 1;
  const open = v.icon === 'pickup';
  const ribbed = v.icon === 'container';
  const ribs: number[] = [];
  if (ribbed) for (let x = x0 + 6; x < x0 + cargoW - 2; x += 6) ribs.push(x);
  return (
    <g strokeLinejoin="round">
      {open ? (
        <>
          <rect
            x={x0}
            y={-7 - cargoH * 0.42}
            width={cargoW}
            height={cargoH * 0.42}
            fill={v.color}
            stroke={NAVY}
            strokeWidth={0.8}
          />
          <rect
            x={x0 + 3}
            y={-7 - cargoH * 0.42 - 6}
            width={9}
            height={6}
            fill={AMBER}
            stroke={NAVY}
            strokeWidth={0.6}
          />
          <rect
            x={x0 + 14}
            y={-7 - cargoH * 0.42 - 4}
            width={7}
            height={4}
            fill={ORANGE}
            stroke={NAVY}
            strokeWidth={0.6}
          />
        </>
      ) : (
        <rect
          x={x0}
          y={-7 - cargoH}
          width={cargoW}
          height={cargoH}
          rx={1.5}
          fill={v.color}
          stroke={NAVY}
          strokeWidth={0.8}
        />
      )}
      {ribs.map((x) => (
        <line
          key={x}
          x1={x}
          y1={-7 - cargoH + 2}
          x2={x}
          y2={-9}
          stroke={NAVY}
          strokeOpacity={0.35}
          strokeWidth={0.8}
        />
      ))}
      <path
        d={`M${cx} -7 L${cx} ${-7 - cabH} L${cx + cabW * 0.55} ${-7 - cabH} L${cx + cabW} ${-7 - cabH * 0.45} L${cx + cabW} -7 Z`}
        fill={v.cabColor}
        stroke={NAVY}
        strokeWidth={0.8}
      />
      <path
        d={`M${cx + 2} ${-7 - cabH + 2.5} L${cx + cabW * 0.5} ${-7 - cabH + 2.5} L${cx + cabW - 2.5} ${-7 - cabH * 0.45 + 1} L${cx + 2} ${-7 - cabH * 0.45 + 1} Z`}
        fill="#E2E8F0"
      />
      <Wheel x={x0 + cargoW * 0.2} />
      {v.wheels === 6 ? <Wheel x={x0 + cargoW * 0.2 + 11} /> : null}
      <Wheel x={cx + cabW * 0.6} />
    </g>
  );
}

function VehicleIcon({ v }: { v: VehicleVisual }) {
  switch (v.icon) {
    case 'bike':
      return <BikeIcon v={v} />;
    case 'three-wheeler':
      return <ThreeWheelerIcon v={v} />;
    default:
      return <TruckIcon v={v} />;
  }
}

const PIN_PATH = 'M0 0 C-4 -9 -11 -14 -11 -23 A11 11 0 1 1 11 -23 C11 -14 4 -9 0 0 Z';

function Pin({
  x,
  y,
  letter,
  fill,
  ink,
  animate,
}: {
  x: number;
  y: number;
  letter: string;
  fill: string;
  ink: string;
  animate: boolean;
}) {
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (shown) return undefined;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [shown]);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        style={{
          transform: shown ? 'scale(1)' : 'scale(0)',
          transition: animate ? 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}
      >
        <ellipse cx={0} cy={0} rx={7} ry={2.5} fill={NAVY} fillOpacity={0.35} />
        <path d={PIN_PATH} fill={fill} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={0} cy={-23} r={7} fill="#FFFFFF" />
        <text
          x={0}
          y={-19.6}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={NAVY}
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          {letter}
        </text>
      </g>
    </g>
  );
}

export function RouteSvgScene({ scene, animate, active, covered, ariaLabel }: RouteSvgSceneProps) {
  const { mode, shape, vehicleType, signature } = scene;
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sampler = useMemo(() => createRouteSampler(shape), [shape]);
  const visual = visualFor(vehicleType);
  const vehicleRef = useRef<SVGGElement>(null);
  const dashRef = useRef<SVGPathElement>(null);
  const elapsedRef = useRef(0);
  const flowRef = useRef(0);
  const d = useMemo(() => shapePath(shape), [shape]);

  const place = useCallback(
    (u: number) => {
      const g = vehicleRef.current;
      if (!g) return;
      const s = sampler.at(u);
      let deg = (s.angle * 180) / Math.PI;
      let flip = 1;
      if (deg > 90 || deg < -90) {
        flip = -1;
        deg = deg > 0 ? deg - 180 : deg + 180;
      }
      deg = clamp(deg, -25, 25);
      g.setAttribute(
        'transform',
        `translate(${s.x.toFixed(2)} ${(s.y + 6).toFixed(2)}) rotate(${deg.toFixed(1)}) scale(${flip * VEHICLE_SCALE} ${VEHICLE_SCALE})`,
      );
    },
    [sampler],
  );

  // The vehicle always waits at pickup; drop is shown as a marker only (never a driving animation).
  useLayoutEffect(() => {
    elapsedRef.current = 0;
    place(0);
  }, [signature, place]);

  useEffect(() => {
    if (!animate || !active) return undefined;
    let raf = 0;
    let last: number | null = null;

    if (mode === 'idle') {
      let lastPaint = 0;
      const frame = (now: number) => {
        if (last !== null) flowRef.current += (Math.min(now - last, 100) / 1000) * FLOW_SPEED;
        last = now;
        if (now - lastPaint >= FLOW_INTERVAL_MS) {
          lastPaint = now;
          dashRef.current?.setAttribute('stroke-dashoffset', (-flowRef.current).toFixed(2));
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [animate, active, mode, signature, place]);

  const start = shape.p0;
  const end = shape.p3;

  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      className="absolute inset-0 h-full w-full transition-opacity duration-300"
      style={{ opacity: covered ? 0 : 1, pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>
      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-sky)`} />
      <g fill="#CBD5E1" fillOpacity={0.7}>
        <rect x={20} y={20} width={34} height={44} rx={3} />
        <rect x={60} y={34} width={26} height={30} rx={3} />
        <rect x={318} y={196} width={38} height={52} rx={3} />
        <rect x={362} y={214} width={24} height={34} rx={3} />
        <circle cx={196} cy={252} r={9} />
        <circle cx={214} cy={258} r={6} />
        <circle cx={150} cy={34} r={8} />
      </g>

      <path
        d={d}
        fill="none"
        stroke={NAVY}
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#16304F"
        strokeWidth={21}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        ref={dashRef}
        d={d}
        fill="none"
        stroke={AMBER}
        strokeWidth={2.5}
        strokeDasharray="9 9"
        strokeLinecap="butt"
      />

      {mode !== 'idle' ? (
        <Pin
          x={start.x}
          y={start.y - PIN_LIFT}
          letter="A"
          fill={AMBER}
          ink={NAVY}
          animate={animate}
        />
      ) : null}
      {mode === 'route' ? (
        <Pin x={end.x} y={end.y - PIN_LIFT} letter="B" fill={ORANGE} ink={NAVY} animate={animate} />
      ) : null}

      <g
        ref={vehicleRef}
        style={{
          opacity: mode === 'idle' ? 0 : 1,
          transition: animate ? 'opacity 300ms' : undefined,
        }}
      >
        <ellipse
          cx={0}
          cy={0.5}
          rx={visual.svgLength * 0.45}
          ry={2.4}
          fill={NAVY}
          fillOpacity={0.4}
        />
        <VehicleIcon v={visual} />
      </g>
    </svg>
  );
}
