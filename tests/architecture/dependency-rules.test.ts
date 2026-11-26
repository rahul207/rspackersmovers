import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

const FRAMEWORKS = [
  'fastify',
  '@fastify/',
  'react',
  'react-dom',
  'react-router',
  'exceljs',
  'pg',
  'postgres',
  'three',
  'vite',
  'framer-motion',
];
const isForbidden = (spec: string, forbidden: string[]) =>
  forbidden.some(
    (f) => spec === f || spec.startsWith(`${f}/`) || (f.endsWith('/') && spec.startsWith(f)),
  );

const rules: { layer: string; dir: string; forbidden: string[] }[] = [
  {
    layer: 'shared',
    dir: 'packages/shared/src',
    forbidden: [
      '@rs/domain',
      '@rs/application',
      '@rs/infrastructure',
      '@rs/api',
      '@rs/web',
      ...FRAMEWORKS,
    ],
  },
  {
    layer: 'domain',
    dir: 'packages/domain/src',
    forbidden: ['@rs/application', '@rs/infrastructure', '@rs/api', '@rs/web', ...FRAMEWORKS],
  },
  {
    layer: 'application',
    dir: 'packages/application/src',
    forbidden: ['@rs/infrastructure', '@rs/api', '@rs/web', ...FRAMEWORKS],
  },
  {
    layer: 'infrastructure',
    dir: 'packages/infrastructure/src',
    forbidden: ['@rs/api', '@rs/web', 'fastify', '@fastify/', 'react', 'react-dom'],
  },
  {
    layer: 'web',
    dir: 'apps/web/src',
    forbidden: [
      '@rs/domain',
      '@rs/application',
      '@rs/infrastructure',
      '@rs/api',
      'fastify',
      'exceljs',
    ],
  },
];

describe('architecture: dependencies point inward', () => {
  for (const { layer, dir, forbidden } of rules) {
    it(`${layer} has no forbidden imports`, () => {
      const offenders: string[] = [];
      for (const file of sourceFiles(join(root, dir))) {
        if (/\.test\.tsx?$/.test(file)) continue;
        for (const spec of importsOf(file)) {
          if (isForbidden(spec, forbidden)) offenders.push(`${file.replace(root, '')} -> ${spec}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it('domain and application avoid Node built-ins', () => {
    const offenders: string[] = [];
    for (const dir of ['packages/domain/src', 'packages/application/src']) {
      for (const file of sourceFiles(join(root, dir))) {
        for (const spec of importsOf(file))
          if (spec.startsWith('node:')) offenders.push(`${file.replace(root, '')} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('repository interfaces live in the application layer and have Excel and PostgreSQL implementations', () => {
    const app = readFileSync(join(root, 'packages/application/src/index.ts'), 'utf8');
    expect(app).toMatch(/booking\/ports/);
    const infra = readFileSync(join(root, 'packages/infrastructure/src/index.ts'), 'utf8');
    expect(infra).toMatch(/excel-quote-repository/);
    expect(infra).toMatch(/postgres\/placeholders/);
  });
});
