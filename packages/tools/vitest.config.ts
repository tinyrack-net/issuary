import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    conditions: ['@tinyauth/source'],
  },
  test: {
    maxWorkers: '90%',
    testTimeout: 20_000,
    exclude: ['./node_modules/*'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
