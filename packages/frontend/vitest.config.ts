import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { preview } from '@vitest/browser-preview';
import { defineConfig } from 'vitest/config';

const MODE = process.env['VITEST_BROWSER_MODE'] as string;
const IS_COVERAGE = process.env['VITEST_COVERAGE'] === '1';

export default defineConfig({
  server: {
    host: '0.0.0.0',
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
              host: '0.0.0.0',
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
