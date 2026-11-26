import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

type Cleanup = () => void;

const noop: Cleanup = () => undefined;

function mediaQuery(query: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null;
  } catch {
    return null;
  }
}

/** Runs `cb` when the browser is idle (setTimeout fallback) so it never competes with the form. */
export function scheduleIdle(cb: () => void, timeoutMs = 1200): Cleanup {
  if (typeof window === 'undefined') return noop;
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(cb, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}

/** Live `prefers-reduced-motion: reduce` state. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = mediaQuery('(prefers-reduced-motion: reduce)');
      if (!mq) return noop;
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      }
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    },
    () => mediaQuery('(prefers-reduced-motion: reduce)')?.matches ?? false,
    () => false,
  );
}

/** True while the referenced element intersects the viewport. */
export function useInViewport(ref: RefObject<Element | null>, rootMargin = '64px'): boolean {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setVisible(last.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return visible;
}

/** False while the browser tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof document === 'undefined') return noop;
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    () => (typeof document === 'undefined' ? true : !document.hidden),
    () => true,
  );
}

interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function detectLowPower(nav: NavigatorHints | undefined): boolean {
  if (!nav) return false;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
  return nav.connection?.saveData === true;
}

/** Low-power / data-saver devices skip the 3D layer. Evaluated once. */
export function useLowPowerDevice(): boolean {
  const [lowPower] = useState(() =>
    detectLowPower(typeof navigator === 'undefined' ? undefined : (navigator as NavigatorHints)),
  );
  return lowPower;
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** null = not checked yet. Detection runs once, when first enabled and the browser is idle. */
export function useWebGLSupport(enabled = true): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled || supported !== null) return undefined;
    return scheduleIdle(() => setSupported(detectWebGL()));
  }, [enabled, supported]);
  return supported;
}
