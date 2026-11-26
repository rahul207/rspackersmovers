import { useEffect, useRef } from 'react';
import { useSiteConfig } from '../site/siteConfigContext';
import { AppLink } from '../../ui/AppLink';
import { useConsent } from './consentContext';

/** Non-modal banner shown until a decision exists for the current consent version. */
export function ConsentBanner() {
  const { hasDecided, saveChoices, openPreferences } = useConsent();
  const { policyLinks } = useSiteConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (hasDecided || !el) {
      root.style.removeProperty('--banner-height');
      return undefined;
    }
    // Reserve space so the banner never covers focused content (WCAG 2.2 focus not obscured).
    const update = () => root.style.setProperty('--banner-height', `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--banner-height');
    };
  }, [hasDecided]);

  if (hasDecided) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby="consent-banner-title"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-navy-900 bg-white shadow-[0_-4px_24px_rgb(11_31_58/0.15)]"
    >
      <div className="container-page flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <h2 id="consent-banner-title" className="text-base font-bold">
            Your privacy choices
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            We use strictly necessary cookies to make this site work. With your permission we would
            also use optional analytics, marketing and location-related processing. Nothing optional
            is switched on until you choose.{' '}
            <AppLink href={policyLinks.cookies} className="font-semibold text-navy-700 underline">
              Read the cookie policy
            </AppLink>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="btn-navy sm:min-w-44"
            onClick={() => saveChoices({ analytics: true, marketing: true, location: true })}
          >
            Accept all
          </button>
          <button
            type="button"
            className="btn-navy sm:min-w-44"
            onClick={() => saveChoices({ analytics: false, marketing: false, location: false })}
          >
            Reject non-essential
          </button>
          <button type="button" className="btn-outline sm:min-w-44" onClick={openPreferences}>
            Customize preferences
          </button>
        </div>
      </div>
    </div>
  );
}
