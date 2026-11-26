import type { VehicleType } from '@rs/shared';
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RouteSvgScene } from './RouteSvgScene';
import {
  useInViewport,
  useLowPowerDevice,
  usePageVisible,
  useReducedMotion,
  useWebGLSupport,
  scheduleIdle,
} from './hooks';
import {
  DEFAULT_VEHICLE,
  ILLUSTRATION_LABEL,
  buildAriaLabel,
  buildCaption,
  buildStatus,
  deriveSceneState,
} from './route-geometry';

// three.js lives only in this dynamically imported chunk.
const Scene3D = lazy(() => import('./Scene3D'));

export interface RouteAnimationLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface RouteAnimationProps {
  pickup?: RouteAnimationLocation | null;
  drop?: RouteAnimationLocation | null;
  vehicleType?: VehicleType;
  className?: string;
}

class LayerBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Small "greeter" mascot shown on top of whichever scene layer (SVG or 3D) is active.
 * Purely decorative chrome, independent of the route geometry below.
 */
function Mascot({ waving }: { waving: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-3 bottom-11 z-10 flex items-end gap-1.5 sm:right-4 sm:bottom-12"
    >
      <div className="rounded-2xl rounded-br-sm bg-white px-2.5 py-1.5 text-[11px] leading-snug font-semibold text-navy-900 shadow-card sm:text-xs">
        Hi! Ready to move? 👋
      </div>
      <svg width="34" height="46" viewBox="0 0 34 46" className="shrink-0 drop-shadow-sm">
        <rect x="12" y="34" width="4" height="10" rx="2" fill="#0f3a2e" />
        <rect x="18" y="34" width="4" height="10" rx="2" fill="#0f3a2e" />
        <rect x="9" y="18" width="16" height="18" rx="6" fill="#e8714a" />
        <rect x="6" y="19" width="4" height="10" rx="2" fill="#e8714a" />
        <g
          className={waving ? 'mascot-wave' : undefined}
          style={{ transformOrigin: '25px 20px', transform: waving ? undefined : 'rotate(18deg)' }}
        >
          <rect x="23" y="10" width="4" height="12" rx="2" fill="#e8714a" />
          <circle cx="25" cy="8" r="3.2" fill="#f5b941" />
        </g>
        {/* Head faces forward so the viewer sees the face, not the back of the head. */}
        <circle cx="17" cy="10" r="7.4" fill="#f5b941" />
        <circle cx="14.2" cy="9.2" r="1" fill="#0f3a2e" />
        <circle cx="19.4" cy="9.2" r="1" fill="#0f3a2e" />
        <circle cx="13.3" cy="12" r="1.2" fill="#e8714a" fillOpacity={0.45} />
        <circle cx="20.3" cy="12" r="1.2" fill="#e8714a" fillOpacity={0.45} />
        <path
          d="M13.6 12.4 q3.4 3.2 6.8 0"
          stroke="#0f3a2e"
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Illustrative pickup -> drop animation. The SVG scene is always rendered and is the accessible,
 * reduced-motion and no-WebGL implementation. A three.js layer is lazily added on top only when
 * the figure is visible, motion is allowed, WebGL works and the device is not low-power.
 * The vehicle always waits at the pickup point; the curve and drop pin are purely decorative and
 * never a driving route, and no coordinates are rendered.
 */
export function RouteAnimation({
  pickup,
  drop,
  vehicleType = DEFAULT_VEHICLE,
  className,
}: RouteAnimationProps) {
  const figureRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const inView = useInViewport(figureRef);
  const pageVisible = usePageVisible();
  const lowPower = useLowPowerDevice();
  const [failed3d, setFailed3d] = useState(false);
  const [mount3d, setMount3d] = useState(false);
  const [ready3d, setReady3d] = useState(false);

  const pLat = pickup?.latitude;
  const pLng = pickup?.longitude;
  const dLat = drop?.latitude;
  const dLng = drop?.longitude;
  // Keyed on primitive values so a new object with the same coordinates does not restart anything.
  const scene = useMemo(
    () =>
      deriveSceneState(
        pLat === undefined || pLng === undefined ? null : { latitude: pLat, longitude: pLng },
        dLat === undefined || dLng === undefined ? null : { latitude: dLat, longitude: dLng },
        vehicleType,
      ),
    [pLat, pLng, dLat, dLng, vehicleType],
  );

  const visible = inView && pageVisible;
  const capable = !reduced && !lowPower && !failed3d;
  const webgl = useWebGLSupport(capable && visible);
  const canMount = capable && visible && webgl === true;

  // Reset during render (not in an effect) when 3D is no longer possible.
  if ((!capable || webgl === false) && (mount3d || ready3d)) {
    setMount3d(false);
    setReady3d(false);
  }

  useEffect(() => {
    if (!canMount || mount3d) return undefined;
    return scheduleIdle(() => setMount3d(true));
  }, [canMount, mount3d]);

  const layer3d = mount3d && capable && webgl === true;
  const covered = layer3d && ready3d;

  const handleReady = useCallback(() => setReady3d(true), []);
  const handleUnavailable = useCallback(() => {
    setFailed3d(true);
    setReady3d(false);
    setMount3d(false);
  }, []);

  const caption = buildCaption(
    scene.mode === 'idle' ? null : pickup,
    scene.mode === 'route' ? drop : null,
  );

  return (
    <figure
      ref={figureRef}
      className={[
        'relative m-0 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-300',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <RouteSvgScene
        scene={scene}
        animate={!reduced}
        active={visible && !covered}
        covered={covered}
        ariaLabel={buildAriaLabel(scene.mode, scene.vehicleType)}
      />

      {layer3d ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: ready3d ? 1 : 0, pointerEvents: 'none' }}
        >
          <LayerBoundary onError={handleUnavailable}>
            <Suspense fallback={null}>
              <Scene3D
                scene={scene}
                active={visible}
                lowPower={lowPower}
                onReady={handleReady}
                onUnavailable={handleUnavailable}
              />
            </Suspense>
          </LayerBoundary>
        </div>
      ) : null}

      <span className="absolute top-2 left-2 z-10 rounded-full bg-action px-2.5 py-1 text-xs leading-none font-semibold text-navy-900 shadow-sm">
        {ILLUSTRATION_LABEL}
      </span>

      <Mascot waving={!reduced} />

      <figcaption className="absolute inset-x-0 bottom-0 z-10 line-clamp-2 bg-[#0f3a2e]/95 px-3 py-2 text-xs leading-snug font-medium text-white sm:text-sm">
        {caption}
      </figcaption>

      <p role="status" aria-live="polite" className="sr-only">
        {buildStatus(scene.mode, scene.vehicleType)}
      </p>
    </figure>
  );
}
