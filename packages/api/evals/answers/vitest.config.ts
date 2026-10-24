import { defineConfig } from 'vitest/config';

// The answer eval runs under Vitest only to mock storage modules; it is not
// part of `pnpm test` (it needs Docker and makes real model calls).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['evals/answers/**/*.eval.ts'],
    testTimeout: 3_600_000,
    hookTimeout: 600_000,
    reporters: ['default'],
    env: {
      LOG_LEVEL: 'silent',
      SUPABASE_URL: 'http://eval.invalid',
      SUPABASE_ANON_KEY: 'eval',
      SUPABASE_SERVICE_ROLE_KEY: 'eval',
    },
  },
});
