import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    maxWorkers: '90%',
    testTimeout: 20000,
    exclude: ['./dist/*', './node_modules/*'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test-utils/**',
        'src/db/cli.ts',
        'src/cli.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        branches: 60,
      },
    },
  },
});
