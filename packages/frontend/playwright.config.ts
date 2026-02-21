import { defineConfig, devices } from '@playwright/test';
import { E2E_DEFAULT_PORTS } from './e2e/configs/default.js';
import { E2E_TOTP_REQUIRED_PORTS } from './e2e/configs/totp-required.js';

const configs = [
  {
    name: 'default',
    testDir: './e2e/tests/default',
    port: E2E_DEFAULT_PORTS.backend,
  },
  {
    name: 'totp-required',
    testDir: './e2e/tests/totp-required',
    port: E2E_TOTP_REQUIRED_PORTS.backend,
  },
];

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
];

export default defineConfig({
  globalSetup: './e2e/setup/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  projects: configs.flatMap((config) =>
    browsers.map((browser) => ({
      name: `${config.name}:${browser.name}`,
      testDir: config.testDir,
      use: {
        baseURL: `http://localhost:${config.port}`,
        trace: 'on-first-retry' as const,
        ...browser.device,
      },
    })),
  ),
});
