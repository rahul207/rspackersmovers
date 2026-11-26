import type { FastifyInstance } from 'fastify';
import { StorageError } from '@rs/infrastructure';
import type { RouteContext } from '../presentation/route-context';
import { envelopeDoc, errorEnvelopeDoc, ok } from '../presentation/http';

const SITEMAP_PATHS = ['/', '/privacy', '/cookie-policy', '/terms', '/cancellation-policy'];

export function registerSystemRoutes(app: FastifyInstance, { container }: RouteContext): void {
  const { env, repositories } = container;
  const startedAt = Date.now();

  app.get(
    '/api/v1/health',
    { schema: { tags: ['System'], summary: 'Liveness probe', response: { 200: envelopeDoc() } } },
    (req) => ok(req, { status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) }),
  );

  app.get(
    '/api/v1/readiness',
    {
      schema: {
        tags: ['System'],
        summary: 'Readiness probe (storage)',
        response: { 200: envelopeDoc(), 503: errorEnvelopeDoc },
      },
    },
    async (req, reply) => {
      const probe = async (fn: () => Promise<unknown>) => {
        try {
          await fn();
          return 'ok' as const;
        } catch (error) {
          req.log.error({ event: 'readiness.failed', err: { message: (error as Error).message } });
          return error instanceof StorageError ? ('storage_error' as const) : ('error' as const);
        }
      };
      const checks = {
        quotes: await probe(() => repositories.quotes.ping()),
        contacts: await probe(() => repositories.contacts.ping()),
        consents: await probe(() => repositories.consents.ping()),
        visitors: await probe(() => repositories.visitors.ping()),
      };
      const ready = Object.values(checks).every((v) => v === 'ok');
      return reply
        .code(ready ? 200 : 503)
        .send(ok(req, { status: ready ? 'ready' : 'not_ready', checks }));
    },
  );

  app.get('/robots.txt', { schema: { hide: true } }, (_req, reply) => {
    void reply.type('text/plain; charset=utf-8').header('cache-control', 'public, max-age=3600');
    return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${env.PUBLIC_SITE_URL}/sitemap.xml\n`;
  });

  app.get('/sitemap.xml', { schema: { hide: true } }, (_req, reply) => {
    void reply
      .type('application/xml; charset=utf-8')
      .header('cache-control', 'public, max-age=3600');
    const urls = SITEMAP_PATHS.map(
      (p) => `  <url><loc>${env.PUBLIC_SITE_URL}${p === '/' ? '/' : p}</loc></url>`,
    ).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  });
}
