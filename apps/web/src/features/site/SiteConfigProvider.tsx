import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { PublicConfig } from '@rs/shared';
import { ApiError, apiGet, errorMessage, setCsrfToken } from '../../lib/apiClient';
import { Logo } from '../../brand/Logo';
import { SiteConfigContext } from './siteConfigContext';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; config: PublicConfig };

/** Loads the public configuration once at startup and exposes it through context. */
export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiGet<PublicConfig>('/config/public', { signal: controller.signal }).then(
      (config) => {
        setCsrfToken(config.csrfToken);
        setState({ status: 'ready', config });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.isAborted) return;
        setState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (state.status === 'ready') {
    return <SiteConfigContext.Provider value={state.config}>{children}</SiteConfigContext.Provider>;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-navy-50 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        {state.status === 'loading' ? (
          <p role="status" className="text-slate-700">
            Loading…
          </p>
        ) : (
          <div role="alert">
            <h1 className="text-xl font-bold">We could not load the site</h1>
            <p className="mt-2 text-slate-700">{state.message}</p>
            <button type="button" className="btn-primary mt-5" onClick={retry}>
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
