import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { preview } from '@vitest/browser-preview';
import { defineConfig } from 'vitest/config';

const MODE = process.env['VITEST_BROWSER_MODE'] as string;

/**
 * Shared Vite plugins for all test projects.
 */
const sharedPlugins = [
  react({
    babel: {
      plugins: [['babel-plugin-react-compiler']],
    },
  }),
  tailwindcss(),
];

/**
 * Shared resolve config for all test projects.
 */
const sharedResolve = {
  alias: {
    '@frontend': path.resolve(__dirname, './src'),
  },
};

export default defineConfig({
  plugins: sharedPlugins,
  resolve: sharedResolve,
  server: {
    host: '0.0.0.0',
    allowedHosts: ['desktop.server.lan'],
  },
  test: {
    projects: [
      {
        plugins: sharedPlugins,
        resolve: sharedResolve,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
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
