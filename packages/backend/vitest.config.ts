import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    maxWorkers: '90%',
    testTimeout: 10000,
    exclude: ['./dist/*', './node_modules/*'],
  },
});
