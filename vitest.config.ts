import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
        '**/e2e/**',
        '**/load-tests/**',
        '**/vitest.config.ts',
        '**/playwright.config.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@glowguide/shared': path.resolve(__dirname, './packages/shared/src'),
      '@glowguide/api': path.resolve(__dirname, './packages/api/src'),
      '@glowguide/workers': path.resolve(__dirname, './packages/workers/src'),
    },
  },
});
