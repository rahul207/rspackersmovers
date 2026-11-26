import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/tests/**/*.test.ts',
      'apps/api/tests/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
      'tests/**/*.test.ts',
      'scripts/**/*.test.{ts,mjs}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/e2e/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
