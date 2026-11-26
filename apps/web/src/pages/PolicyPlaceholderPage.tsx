import { Link, useLocation } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSiteConfig } from '../features/site/siteConfigContext';

interface PolicyInfo {
  title: string;
  covers: string[];
}

const POLICIES: Record<string, PolicyInfo> = {
  '/privacy': {
    title: 'Privacy policy',
    covers: [
      'What personal information we collect through the quote and contact forms',
      'Why we use it and the legal basis for doing so',
      'How long we keep it and who can access it',
      'Your rights and how to exercise them',
    ],
  },
  '/cookie-policy': {
    title: 'Cookie policy',
    covers: [
      'The strictly necessary cookies this site uses',
      'Optional analytics, marketing and location-related processing, and how to change your choices',
    ],
  },
  '/terms': {
    title: 'Terms and conditions',
    covers: [
      'How quotations, bookings and services are handled',
      'Responsibilities of the customer and the company',
    ],
  },
  '/cancellation-policy': {
    title: 'Cancellation policy',
    covers: ['How to cancel or reschedule a booking', 'Any charges that may apply'],
  },
  '/data-request': {
    title: 'Data request',
    covers: ['How to ask for a copy of your data', 'How to ask us to correct or delete your data'],
  },
};

export default function PolicyPlaceholderPage() {
  const { pathname } = useLocation();
  const { business } = useSiteConfig();
  const policy = POLICIES[pathname] ?? { title: 'Policy', covers: [] };
  usePageTitle(policy.title);

  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{policy.title}</h1>
      <p
        role="note"
        className="mt-5 rounded-xl border-2 border-amber-700 bg-amber-50 p-4 font-semibold text-amber-900"
      >
        Placeholder — final wording requires legal review.
      </p>
      <p className="mt-5 text-slate-700">
        This page is a placeholder and does not yet contain the final text. When approved, it will
        cover:
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-6 text-slate-800">
        {policy.covers.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {business.email ? (
        <p className="mt-6 text-slate-700">
          Questions in the meantime? Email{' '}
          <a className="font-semibold underline" href={`mailto:${business.email}`}>
            {business.email}
          </a>
          .
        </p>
      ) : null}
      <p className="mt-8">
        <Link to="/" className="btn-navy">
          Back to home
        </Link>
      </p>
    </div>
  );
}
