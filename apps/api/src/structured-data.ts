import type { SiteContent } from '@rs/shared';
import type { AppEnv } from './config/env';

type Json = Record<string, unknown>;

/**
 * Structured data built ONLY from configured business facts and the site content.
 * Nothing is invented: missing phone/address/email/social links are simply omitted.
 */
export function buildStructuredData(env: AppEnv, content: SiteContent): Json[] {
  const url = env.PUBLIC_SITE_URL;
  // schema.org `telephone` expects a single number; use the first of any comma-separated list.
  const primaryPhone = env.BUSINESS_PHONE?.split(',')[0]?.trim();
  const sameAs = [
    env.SOCIAL_FACEBOOK_URL,
    env.SOCIAL_INSTAGRAM_URL,
    env.SOCIAL_LINKEDIN_URL,
    env.SOCIAL_YOUTUBE_URL,
    env.SOCIAL_X_URL,
  ].filter((v): v is string => Boolean(v));

  const org: Json = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${url}/#organization`,
    name: env.BUSINESS_NAME,
    url,
    ...(env.BUSINESS_EMAIL ? { email: env.BUSINESS_EMAIL } : {}),
    ...(primaryPhone ? { telephone: primaryPhone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const out: Json[] = [org];

  // LocalBusiness needs a real contact point; emit it only when one is configured.
  if (env.BUSINESS_ADDRESS || primaryPhone) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'MovingCompany',
      '@id': `${url}/#localbusiness`,
      name: env.BUSINESS_NAME,
      url,
      ...(primaryPhone ? { telephone: primaryPhone } : {}),
      ...(env.BUSINESS_EMAIL ? { email: env.BUSINESS_EMAIL } : {}),
      ...(env.BUSINESS_ADDRESS
        ? { address: { '@type': 'PostalAddress', streetAddress: env.BUSINESS_ADDRESS } }
        : {}),
    });
  }

  for (const s of content.services) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: s.title,
      description: s.description,
      provider: { '@id': `${url}/#organization` },
      areaServed: 'IN',
    });
  }

  out.push({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  });

  return out;
}

/** Serialises JSON-LD safely for embedding in HTML (prevents `</script>` breakouts). */
export function renderJsonLdScript(data: Json[]): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}
