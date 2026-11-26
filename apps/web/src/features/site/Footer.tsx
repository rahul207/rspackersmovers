import { Link } from 'react-router-dom';
import { Logo } from '../../brand/Logo';
import { useConsent } from '../consent/consentContext';
import { useSiteContent } from '../content/useSiteContent';
import { DEFAULT_WHATSAPP_GREETING, buildWhatsappUrl } from '../../lib/whatsapp';
import { splitPhones, telHref } from '../../lib/format';
import { AppLink } from '../../ui/AppLink';
import { MailIcon, PhoneIcon, MapPinIcon, WhatsappIcon } from '../../ui/Icons';
import { useSiteConfig } from './siteConfigContext';

const COMPANY_LINKS = [
  { label: 'Clients', id: 'clients' },
  { label: 'Testimonials', id: 'testimonials' },
  { label: 'About Us', id: 'about' },
  { label: 'FAQ', id: 'faq' },
  { label: 'Contact', id: 'contact' },
] as const;

const linkClass =
  'inline-flex min-h-11 items-center rounded-lg text-sm text-navy-100 underline-offset-2 hover:text-white hover:underline';

export function Footer() {
  const { business, social, policyLinks } = useSiteConfig();
  const { openPreferences } = useConsent();
  const { state } = useSiteContent();
  const whatsappUrl = buildWhatsappUrl(business.whatsappNumber, DEFAULT_WHATSAPP_GREETING);
  const services = state.status === 'ready' ? state.content.services : [];

  return (
    <footer id="site-footer" className="on-dark bg-navy-900 text-white">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to={{ pathname: '/', hash: '#home' }} className="inline-block rounded-xl">
              <Logo onDark />
            </Link>
            <p className="mt-4 text-sm text-navy-100">
              Packing, moving, vehicle transport and courier services, with every quotation
              confirmed personally by our operations team.
            </p>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-5"
              >
                <WhatsappIcon size={20} />
                Chat on WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>

          <nav aria-labelledby="footer-services">
            <h2 id="footer-services" className="text-base font-bold">
              Services
            </h2>
            <ul className="mt-3">
              {services.length > 0 ? (
                services.map((service) => (
                  <li key={service.id}>
                    <Link to={{ pathname: '/', hash: '#services' }} className={linkClass}>
                      {service.title}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link to={{ pathname: '/', hash: '#services' }} className={linkClass}>
                    All services
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="text-base font-bold">
              Company
            </h2>
            <ul className="mt-3">
              {COMPANY_LINKS.map((item) => (
                <li key={item.id}>
                  <Link to={{ pathname: '/', hash: `#${item.id}` }} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-base font-bold">Contact</h2>
            <ul className="mt-3 space-y-2 text-sm text-navy-100">
              {business.phone ? (
                <li className="flex items-start gap-2.5">
                  <PhoneIcon size={18} className="mt-0.5 shrink-0" />
                  <span className="flex flex-col">
                    {splitPhones(business.phone).map((phone) => (
                      <a
                        key={phone}
                        className="underline underline-offset-2 hover:text-white"
                        href={telHref(phone)}
                      >
                        {phone}
                      </a>
                    ))}
                  </span>
                </li>
              ) : null}
              {business.email ? (
                <li className="flex items-start gap-2.5">
                  <MailIcon size={18} className="mt-0.5 shrink-0" />
                  <a
                    className="break-all underline underline-offset-2 hover:text-white"
                    href={`mailto:${business.email}`}
                  >
                    {business.email}
                  </a>
                </li>
              ) : null}
              {business.address ? (
                <li className="flex items-start gap-2.5">
                  <MapPinIcon size={18} className="mt-0.5 shrink-0" />
                  <span>{business.address}</span>
                </li>
              ) : null}
            </ul>
            {social.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-bold">Follow us</h3>
                <ul className="mt-1">
                  {social.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${linkClass} capitalize`}
                      >
                        {item.network}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 border-t border-navy-700 pt-6">
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5">
              <li>
                <AppLink href={policyLinks.privacy} className={linkClass}>
                  Privacy policy
                </AppLink>
              </li>
              <li>
                <AppLink href={policyLinks.cookies} className={linkClass}>
                  Cookie policy
                </AppLink>
              </li>
              <li>
                <AppLink href={policyLinks.terms} className={linkClass}>
                  Terms and conditions
                </AppLink>
              </li>
              <li>
                <AppLink href={policyLinks.cancellation} className={linkClass}>
                  Cancellation policy
                </AppLink>
              </li>
              <li>
                <AppLink href={policyLinks.dataRequest} className={linkClass}>
                  Data request
                </AppLink>
              </li>
              <li>
                <button
                  type="button"
                  className={`${linkClass} underline`}
                  onClick={openPreferences}
                >
                  Cookie settings
                </button>
              </li>
            </ul>
          </nav>
          <p className="mt-4 text-sm text-navy-100">
            &copy; {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
          <p className="mt-1 text-sm text-navy-100">
            Built for performance, accessibility, and privacy
          </p>
        </div>
      </div>
    </footer>
  );
}
