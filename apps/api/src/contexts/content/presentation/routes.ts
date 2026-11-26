import type { FastifyInstance } from 'fastify';
import { CONSENT_VERSION, PRIVACY_NOTICE_VERSION, type PublicConfig } from '@rs/shared';
import type { RouteContext } from '../../shared-kernel/presentation/route-context';
import { envelopeDoc, ok } from '../../shared-kernel/presentation/http';

const SOCIAL_KEYS = [
  ['Facebook', 'SOCIAL_FACEBOOK_URL'],
  ['Instagram', 'SOCIAL_INSTAGRAM_URL'],
  ['LinkedIn', 'SOCIAL_LINKEDIN_URL'],
  ['YouTube', 'SOCIAL_YOUTUBE_URL'],
  ['X', 'SOCIAL_X_URL'],
] as const;

export function registerContentRoutes(
  app: FastifyInstance,
  { container, csrf }: RouteContext,
): void {
  const { env, useCases } = container;

  app.get(
    '/api/v1/config/public',
    {
      schema: {
        tags: ['Content'],
        summary: 'Public site configuration',
        description:
          'Business details, feature flags and a CSRF token (also sets the signed CSRF cookie). Contains no secrets.',
        response: { 200: envelopeDoc() },
      },
    },
    async (req, reply) => {
      const social = SOCIAL_KEYS.flatMap(([network, key]) => {
        const url = env[key];
        return url ? [{ network, url }] : [];
      });
      const dataRequest = env.DATA_REQUEST_EMAIL ?? env.BUSINESS_EMAIL;

      const config: PublicConfig = {
        business: {
          name: env.BUSINESS_NAME,
          ...(env.BUSINESS_PHONE ? { phone: env.BUSINESS_PHONE } : {}),
          ...(env.BUSINESS_EMAIL ? { email: env.BUSINESS_EMAIL } : {}),
          ...(env.BUSINESS_ADDRESS ? { address: env.BUSINESS_ADDRESS } : {}),
          ...(env.WHATSAPP_NUMBER ? { whatsappNumber: env.WHATSAPP_NUMBER } : {}),
        },
        siteUrl: env.PUBLIC_SITE_URL,
        social,
        policyLinks: {
          privacy: env.PRIVACY_POLICY_URL,
          cookies: env.COOKIE_POLICY_URL,
          terms: env.TERMS_URL,
          cancellation: env.CANCELLATION_POLICY_URL,
          dataRequest: dataRequest ? `mailto:${dataRequest}` : '/data-request',
        },
        features: {
          visitorAnalytics: env.ENABLE_VISITOR_ANALYTICS,
        },
        captcha: {
          provider: container.captcha.provider,
          ...(container.captcha.provider === 'turnstile' && env.CAPTCHA_SITE_KEY
            ? { siteKey: env.CAPTCHA_SITE_KEY }
            : {}),
        },
        consentVersion: CONSENT_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        csrfToken: csrf.issue(req, reply),
      };
      void reply.header('cache-control', 'no-store');
      return ok(req, config);
    },
  );

  app.get(
    '/api/v1/content',
    {
      schema: {
        tags: ['Content'],
        summary: 'Services, FAQ, demonstration clients and demonstration testimonials',
        description:
          'Clients and testimonials are fictional demonstration content flagged isDemonstration=true.',
        response: { 200: envelopeDoc() },
      },
    },
    async (req, reply) => {
      void reply.header('cache-control', 'public, max-age=300');
      return ok(req, await useCases.getContent.execute());
    },
  );
}
