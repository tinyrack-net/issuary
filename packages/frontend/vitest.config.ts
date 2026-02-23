import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { preview } from '@vitest/browser-preview';
import { defineConfig } from 'vitest/config';

const MODE = process.env['VITEST_BROWSER_MODE'] as string;

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['desktop.server.lan'],
  },
  test: {
    projects: [
      {
        plugins: [
          react({
            babel: {
              plugins: [['babel-plugin-react-compiler']],
            },
          }),
          tailwindcss(),
        ],
        resolve: {
          alias: {
            '@frontend': path.resolve(__dirname, './src'),
          },
        },
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test-utils/vitest-browser-setup.ts'],
          browser: {
            enabled: true,
            provider: MODE === 'preview' ? preview() : playwright(),
            headless: MODE !== 'preview',
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
});
