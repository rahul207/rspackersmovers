import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiPost } from '../../lib/apiClient';
import { useSiteConfig } from '../site/siteConfigContext';
import { useConsent } from './consentContext';

interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
}

function readUtm(search: string): UtmParams | undefined {
  const params = new URLSearchParams(search);
  const utm: UtmParams = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) utm.source = source.slice(0, 100);
  if (medium) utm.medium = medium.slice(0, 100);
  if (campaign) utm.campaign = campaign.slice(0, 100);
  return Object.keys(utm).length > 0 ? utm : undefined;
}

function externalReferrerOrigin(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

/**
 * Sends one privacy-conscious page_view per route change, only when analytics consent is
 * granted and the feature is enabled. Sends the pathname only (no query, hash or coordinates).
 */
export function useAnalytics(): void {
  const { pathname, search } = useLocation();
  const { features } = useSiteConfig();
  const { allows } = useConsent();
  const enabled = features.visitorAnalytics && allows('analytics');
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastSent.current = null;
      return;
    }
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    const utm = readUtm(search);
    const referrer = externalReferrerOrigin();
    apiPost('/analytics/events', {
      type: 'page_view',
      path: pathname,
      ...(referrer ? { referrer } : {}),
      language: navigator.language,
      ...(utm ? { utm } : {}),
    }).catch(() => undefined);
    // `search` only feeds campaign parameters for the page that was just opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pathname]);
}
