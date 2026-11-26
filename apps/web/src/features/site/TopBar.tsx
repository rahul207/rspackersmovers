import { splitPhones, telHref } from '../../lib/format';
import { MailIcon, PhoneIcon } from '../../ui/Icons';
import { useSiteConfig } from './siteConfigContext';

/**
 * Slim utility banner above the main header: quick-reach phone and email for anyone visiting
 * the site. Hidden on narrow screens to keep the mobile header uncluttered; both contact
 * methods remain reachable from the footer and contact section on every screen size.
 */
export function TopBar() {
  const { business } = useSiteConfig();
  const phones = business.phone ? splitPhones(business.phone) : [];
  if (phones.length === 0 && !business.email) return null;

  return (
    <div className="on-dark hidden border-b border-navy-700 bg-navy-950 text-navy-50 sm:block">
      <div className="container-page flex min-h-9 flex-wrap items-center justify-end gap-x-5 gap-y-1 py-1.5 text-xs font-semibold">
        {phones.map((phone) => (
          <a
            key={phone}
            href={telHref(phone)}
            className="inline-flex items-center gap-1.5 rounded-md py-1 hover:text-action hover:underline"
          >
            <PhoneIcon size={14} className="shrink-0" />
            {phone}
          </a>
        ))}
        {business.email ? (
          <a
            href={`mailto:${business.email}`}
            className="inline-flex items-center gap-1.5 rounded-md py-1 hover:text-action hover:underline"
          >
            <MailIcon size={14} className="shrink-0" />
            {business.email}
          </a>
        ) : null}
      </div>
    </div>
  );
}
