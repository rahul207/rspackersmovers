import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const forbid = (name, patterns) => ({
  'no-restricted-imports': [
    'error',
    { patterns: patterns.map((p) => ({ group: [p], message: `${name} must not depend on ${p}` })) },
  ],
});

const FRAMEWORKS = [
  'fastify',
  '@fastify/*',
  'react',
  'react-dom',
  'react-*',
  'exceljs',
  'pg',
  'postgres',
  'three',
  'vite',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'storage/**',
      'apps/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2023 } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  // Dependency rule: dependencies point inward.
  { files: ['packages/shared/src/**/*.ts'], rules: forbid('@rs/shared', ['@rs/*', ...FRAMEWORKS]) },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: forbid('@rs/domain', [
      '@rs/application',
      '@rs/infrastructure',
      '@rs/api',
      '@rs/web',
      'node:*',
      ...FRAMEWORKS,
    ]),
  },
  {
    files: ['packages/application/src/**/*.ts'],
    rules: forbid('@rs/application', [
      '@rs/infrastructure',
      '@rs/api',
      '@rs/web',
      'node:*',
      ...FRAMEWORKS,
    ]),
  },
  {
    files: ['packages/infrastructure/src/**/*.ts'],
    rules: forbid('@rs/infrastructure', [
      '@rs/api',
      '@rs/web',
      'fastify',
      '@fastify/*',
      'react',
      'react-dom',
    ]),
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: ['apps/web/e2e/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2023 } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...forbid('@rs/web', [
        '@rs/domain',
        '@rs/application',
        '@rs/infrastructure',
        '@rs/api',
        'fastify',
        'exceljs',
      ]),
    },
  },
  { files: ['**/*.mjs', 'scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  prettier,
);
