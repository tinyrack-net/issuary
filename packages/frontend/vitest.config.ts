import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

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
    '@frontend-e2e': path.resolve(__dirname, './e2e'),
    '@backend': path.resolve(__dirname, '../backend/src'),
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
      // ---------------------------------------------------------
      // Unit & Component tests
      // Colocated with source files in src/
      // No backend server needed.
      // ---------------------------------------------------------
      {
        plugins: sharedPlugins,
        resolve: sharedResolve,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
          },
        },
      },

      // ---------------------------------------------------------
      // E2E: minimal config
      // Backend on port 18080, Vite on port 19080.
      // Minimal auth settings (password enabled, no TOTP).
      // ---------------------------------------------------------
      {
        plugins: sharedPlugins,
        resolve: sharedResolve,
        test: {
          name: 'e2e:minimal',
          include: ['e2e/tests/minimal/**/*.test.{ts,tsx}'],
          globalSetup: ['./e2e/setups/minimal.setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },

      // ---------------------------------------------------------
      // E2E: TOTP-required config
      // Backend on port 18081, Vite on port 19081.
      // Auth with second_factor.required=true, totp.enabled=true.
      // Uncomment when you add tests in e2e/tests/totp-required/.
      // ---------------------------------------------------------
      // {
      //   plugins: sharedPlugins,
      //   resolve: sharedResolve,
      //   test: {
      //     name: 'e2e:totp-required',
      //     include: ['e2e/tests/totp-required/**/*.test.{ts,tsx}'],
      //     globalSetup: ['./e2e/setups/totp-required.setup.ts'],
      //     browser: {
      //       enabled: true,
      //       provider: playwright(),
      //       headless: true,
      //       instances: [{ browser: 'chromium' }],
      //     },
      //   },
      // },
    ],
  },
});
