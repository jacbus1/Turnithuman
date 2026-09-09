import { defineConfig } from 'vitest/config';

// Deliberately separate from the default test suite: this downloads the real
// browser model and should only run when `npm run test:model` is requested.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/model-smoke.test.ts'],
    testTimeout: 300_000,
  },
});
