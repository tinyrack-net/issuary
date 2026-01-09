import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    reporters: 'verbose',
    silent: false,
    printConsoleTrace: true,
    logHeapUsage: true,
    exclude: ['./dist/*', './node_modules/*'],
  },
});
