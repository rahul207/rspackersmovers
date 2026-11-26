import { useCallback, useEffect, useState } from 'react';
import type { SiteContent } from '@rs/shared';
import { ApiError, apiGet, errorMessage } from '../../lib/apiClient';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; content: SiteContent };

let cached: SiteContent | undefined;
let inflight: Promise<SiteContent> | undefined;

function loadContent(): Promise<SiteContent> {
  if (cached) return Promise.resolve(cached);
  inflight ??= apiGet<SiteContent>('/content')
    .then((content) => {
      cached = content;
      return content;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

/** Site content (services, FAQs, demonstration clients and testimonials), fetched once and cached. */
export function useSiteContent(): { state: State; retry: () => void } {
  const [state, setState] = useState<State>(() =>
    cached ? { status: 'ready', content: cached } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    loadContent().then(
      (content) => {
        if (active) setState({ status: 'ready', content });
      },
      (error: unknown) => {
        if (active && !(error instanceof ApiError && error.isAborted)) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { state, retry };
}
