import { Suspense, useContext, type ReactNode } from 'react';
import { useInViewOnce } from '../hooks/useInViewOnce';
import { EagerMountContext } from './eagerMountContext';

interface DeferredSectionProps {
  id: string;
  /** id of the heading rendered by the lazy content. */
  headingId: string;
  /** Reserved height (Tailwind class) to limit layout shift before the content mounts. */
  minHeightClass: string;
  className?: string;
  children: ReactNode;
}

function SectionSkeleton() {
  return (
    <div className="container-page py-16" aria-hidden="true">
      <div className="skeleton h-5 w-32" />
      <div className="skeleton mt-4 h-9 w-2/3 max-w-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
        <div className="skeleton hidden h-40 lg:block" />
      </div>
    </div>
  );
}

/**
 * Always renders the <section> (so anchor links resolve), but only mounts the lazy
 * content once the section approaches the viewport or an anchor navigation forces it.
 */
export function DeferredSection({
  id,
  headingId,
  minHeightClass,
  className = '',
  children,
}: DeferredSectionProps) {
  const forced = useContext(EagerMountContext);
  const [ref, seen] = useInViewOnce<HTMLElement>('700px 0px', forced);
  const mounted = seen || forced;

  return (
    <section
      id={id}
      ref={ref}
      tabIndex={-1}
      aria-labelledby={mounted ? headingId : undefined}
      aria-label={mounted ? undefined : id}
      className={`${mounted ? '' : minHeightClass} ${className}`}
    >
      {mounted ? <Suspense fallback={<SectionSkeleton />}>{children}</Suspense> : null}
    </section>
  );
}
