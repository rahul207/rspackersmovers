import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import type { Container } from './composition-root';
import { buildStructuredData, renderJsonLdScript } from './structured-data';

const KNOWN_PAGES = [
  '/',
  '/privacy',
  '/cookie-policy',
  '/terms',
  '/cancellation-policy',
  '/data-request',
];

export interface WebHost {
  /** Server-rendered index.html (canonical URL and JSON-LD injected). */
  html: string;
}

/** Serves the built frontend with proper caching headers and server-side SEO injection. */
export async function registerWebHost(
  app: FastifyInstance,
  container: Container,
): Promise<WebHost | null> {
  const { env } = container;
  if (!env.serveWeb) return null;

  const indexPath = join(env.WEB_DIST_PATH, 'index.html');
  if (!existsSync(indexPath)) {
    app.log.warn(
      { event: 'web.dist.missing' },
      'SERVE_WEB is on but the web build was not found; run `npm run build`.',
    );
    return null;
  }

  const content = await container.useCases.getContent.execute();
  const html = readFileSync(indexPath, 'utf8')
    .replaceAll('__SITE_URL__', env.PUBLIC_SITE_URL)
    .replace('<!--__JSON_LD__-->', renderJsonLdScript(buildStructuredData(env, content)));

  await app.register(fastifyStatic, {
    root: env.WEB_DIST_PATH,
    index: false,
    wildcard: false,
    globIgnore: ['**/index.html'],
    cacheControl: false,
    setHeaders(res, path) {
      const normalised = path.replace(/\\/g, '/');
      res.setHeader(
        'cache-control',
        normalised.includes('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=86400',
      );
    },
  });

  for (const page of KNOWN_PAGES) {
    app.get(page, { schema: { hide: true } }, (_req, reply) => {
      void reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache');
      return html;
    });
  }
  return { html };
}
