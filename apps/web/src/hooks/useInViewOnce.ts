import { useEffect, useRef, useState, type RefObject } from 'react';

/** True once the element has come within `rootMargin` of the viewport (sticky: never resets). */
export function useInViewOnce<T extends Element>(
  rootMargin = '600px 0px',
  disabled = false,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  const supported = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    if (seen || disabled || !supported) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen, disabled, supported, rootMargin]);

  return [ref, seen || !supported];
}
