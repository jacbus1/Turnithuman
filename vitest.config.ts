import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/model-smoke.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/analysis.ts', 'lib/advice.ts', 'lib/parsers.ts'],
      thresholds: { statements: 75, branches: 65, functions: 75, lines: 75 },
    },
  },
});
