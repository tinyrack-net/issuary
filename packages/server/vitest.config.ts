import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#server': './src/',
    },
  },
  test: {
    maxWorkers: '100%',
    testTimeout: 20000,
    exclude: ['./dist/*', './node_modules/*', 'src/**/*.perf.test.ts'],
    coverage: {
      provider: 'v8',
      clean: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        branches: 60,
      },
    },
  },
});
