import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../brand/Logo';
import { DEFAULT_WHATSAPP_GREETING, buildWhatsappUrl } from '../../lib/whatsapp';
import { CloseIcon, MenuIcon, WhatsappIcon } from '../../ui/Icons';
import { useSiteConfig } from './siteConfigContext';

export const NAV_ITEMS = [
  { label: 'Home', id: 'home' },
  { label: 'Services', id: 'services' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'Clients', id: 'clients' },
  { label: 'Testimonials', id: 'testimonials' },
  { label: 'About Us', id: 'about' },
  { label: 'Contact', id: 'contact' },
] as const;

const QUOTE_TARGET = { pathname: '/', hash: '#quote-form-card' };
const DESKTOP_QUERY = '(min-width: 1024px)';

export function Header() {
  const { business } = useSiteConfig();
  const whatsappUrl = buildWhatsappUrl(business.whatsappNumber, DEFAULT_WHATSAPP_GREETING);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = (restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    // Make the page behind the open menu inert so keyboard and screen-reader users stay in the menu.
    const background = ['main-content', 'site-footer']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    for (const el of background) el.inert = true;
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (media.matches) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    media.addEventListener('change', onChange);
    return () => {
      for (const el of background) el.inert = false;
      document.removeEventListener('keydown', onKeyDown);
      media.removeEventListener('change', onChange);
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-30 border-b bg-white transition-shadow ${
        scrolled || menuOpen ? 'border-navy-100 shadow-header' : 'border-transparent'
      }`}
    >
      <div
        aria-hidden="true"
        className="h-1 w-full bg-[linear-gradient(90deg,var(--color-navy-600)_0%,var(--color-navy-600)_33%,var(--color-action)_33%,var(--color-action)_66%,var(--color-coral)_66%,var(--color-coral)_100%)]"
      />
      <div className="container-page flex min-h-16 items-center justify-between gap-3 py-2">
        <Link
          to={{ pathname: '/', hash: '#home' }}
          className="inline-flex min-h-11 items-center rounded-xl"
        >
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <Link
                  to={{ pathname: '/', hash: `#${item.id}` }}
                  className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold whitespace-nowrap text-navy-900 hover:bg-navy-50 hover:text-coral-strong"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline px-3.5"
              >
                <WhatsappIcon size={20} />
                <span className="hidden 2xl:inline">WhatsApp</span>
                <span className="sr-only 2xl:hidden">WhatsApp</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            <Link to={QUOTE_TARGET} className="btn-primary whitespace-nowrap">
              Get a Quote
            </Link>
          </div>
          <button
            ref={toggleRef}
            type="button"
            className="btn-outline px-3 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={!menuOpen}
        className="border-t border-navy-100 bg-white lg:hidden"
      >
        <nav
          aria-label="Mobile"
          className="container-page max-h-[calc(100dvh-4.5rem)] overflow-y-auto py-3"
        >
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <Link
                  to={{ pathname: '/', hash: `#${item.id}` }}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-navy-900 hover:bg-navy-50"
                  onClick={() => closeMenu(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 pb-2">
            <Link to={QUOTE_TARGET} className="btn-primary" onClick={() => closeMenu(false)}>
              Get a Quote
            </Link>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                <WhatsappIcon size={20} />
                WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
