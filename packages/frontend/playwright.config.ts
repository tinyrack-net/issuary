import { defineConfig, devices } from '@playwright/test';
import { E2E_PORTS } from './e2e/fixtures/index.js';

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/setup/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${E2E_PORTS.backend}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
