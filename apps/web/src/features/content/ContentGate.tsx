import type { ReactNode } from 'react';
import type { SiteContent } from '@rs/shared';
import { useSiteContent } from './useSiteContent';

/** Renders loading / error states around content-driven sections. */
export function ContentGate({ children }: { children: (content: SiteContent) => ReactNode }) {
  const { state, retry } = useSiteContent();
  if (state.status === 'ready') return <>{children(state.content)}</>;
  if (state.status === 'loading') {
    return (
      <div
        role="status"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading content"
      >
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
        <div className="skeleton hidden h-40 lg:block" />
      </div>
    );
  }
  return (
    <div role="alert" className="mt-8 rounded-2xl border-2 border-red-700 bg-red-50 p-5">
      <p className="font-semibold text-red-900">{state.message}</p>
      <button type="button" className="btn-outline mt-3" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
