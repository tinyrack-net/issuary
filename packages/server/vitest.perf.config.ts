import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#server': './src/',
    },
  },
  test: {
    include: ['src/**/*.perf.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60000,
    hookTimeout: 60000,
    isolate: true,
  },
});
