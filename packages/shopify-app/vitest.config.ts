import { defineConfig } from 'vitest/config';

// Unit tests for pure and server helpers. Routes need the embedded admin and are
// checked in a dev store instead.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
