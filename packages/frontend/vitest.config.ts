import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { preview } from '@vitest/browser-preview';
import { defineConfig } from 'vitest/config';

const MODE = process.env['VITEST_BROWSER_MODE'];
const IS_COVERAGE = process.env['VITEST_COVERAGE'] === '1';
const HOST = MODE === 'preview' ? '0.0.0.0' : '127.0.0.1';
const BROWSER_API_PORT = Number(
  process.env['VITEST_BROWSER_API_PORT'] ?? Number.NaN,
);
const browserApiPort =
  Number.isInteger(BROWSER_API_PORT) && BROWSER_API_PORT > 0
    ? { port: BROWSER_API_PORT }
    : {};

export default defineConfig({
  server: {
    host: HOST,
    allowedHosts: ['desktop.server.lan'],
  },
  test: {
    coverage: {
      provider: 'v8',
      clean: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-utils/**',
        'src/routeTree.gen.ts',
      ],
      thresholds: {
        lines: 35,
        branches: 25,
        functions: 30,
        statements: 35,
      },
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        resolve: {
          conditions: ['@tinyauth/source'],
        },
        plugins: [react(), tailwindcss()],
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test-utils/vitest-browser-setup.ts'],
          browser: {
            enabled: true,
            api: {
              host: HOST,
              ...browserApiPort,
            },
            provider: MODE === 'preview' ? preview() : playwright(),
            headless: MODE !== 'preview',
            instances: IS_COVERAGE
              ? [{ browser: 'chromium' }]
              : [{ browser: 'chromium' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
});
