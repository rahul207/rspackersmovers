import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ConsentBanner } from '../consent/ConsentBanner';
import { CookiePreferencesDialog } from '../consent/CookiePreferencesDialog';
import { MarketingScripts } from '../consent/MarketingScripts';
import { useAnalytics } from '../consent/useAnalytics';
import { focusQuoteForm, jumpToId } from '../../lib/scroll';
import { EagerMountContext } from '../../ui/eagerMountContext';
import { Footer } from './Footer';
import { Header } from './Header';
import { TopBar } from './TopBar';

const SETTLE_MS = 1500;

/** Handles in-page anchors, which BrowserRouter does not scroll to by itself. */
function useRouteScroll(): void {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (pathname !== '/' || !id) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return undefined;
    }
    if (id === 'quote-form-card') {
      const frame = window.requestAnimationFrame(focusQuoteForm);
      return () => window.cancelAnimationFrame(frame);
    }

    jumpToId(id);
    document.getElementById(id)?.focus({ preventScroll: true });

    // Lazy sections change the page height as they mount; keep the target aligned until the user scrolls.
    let active = true;
    const observer = new ResizeObserver(() => {
      if (active) jumpToId(id);
    });
    observer.observe(document.body);
    const stop = () => {
      active = false;
      observer.disconnect();
    };
    const timer = window.setTimeout(stop, SETTLE_MS);
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    for (const name of events) window.addEventListener(name, stop, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      stop();
      for (const name of events) window.removeEventListener(name, stop);
    };
    // `key` re-runs this for repeated clicks on the same anchor.
  }, [pathname, hash, key]);
}

export function Layout({ children }: { children: ReactNode }) {
  const { hash } = useLocation();
  const [eager, setEager] = useState(hash !== '');
  if (hash !== '' && !eager) setEager(true);

  useRouteScroll();
  useAnalytics();

  return (
    <EagerMountContext.Provider value={eager}>
      <SkipLink />
      <TopBar />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <ConsentBanner />
      <CookiePreferencesDialog />
      <MarketingScripts />
    </EagerMountContext.Provider>
  );
}

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-action focus:px-4 focus:py-3 focus:font-bold focus:text-navy-900"
      onClick={(event) => {
        event.preventDefault();
        const main = document.getElementById('main-content');
        main?.focus();
        main?.scrollIntoView();
      }}
    >
      Skip to main content
    </a>
  );
}
