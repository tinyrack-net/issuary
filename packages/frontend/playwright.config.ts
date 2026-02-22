import { defineConfig, devices } from '@playwright/test';
import { E2E_ACCOUNT_DELETION_PORTS } from './e2e/configs/account-deletion.js';
import { E2E_EMAIL_VERIFICATION_PORTS } from './e2e/configs/email-verification.js';
import { E2E_MINIMAL_PORTS } from './e2e/configs/minimal.js';
import { E2E_REGISTRATION_DISABLED_PORTS } from './e2e/configs/registration-disabled.js';
import { E2E_TERMS_PORTS } from './e2e/configs/terms.js';
import { E2E_TOTP_REQUIRED_PORTS } from './e2e/configs/totp-required.js';

const configs = [
  {
    name: 'minimal',
    testDir: './e2e/tests/minimal',
    port: E2E_MINIMAL_PORTS.backend,
  },
  {
    name: 'totp-required',
    testDir: './e2e/tests/totp-required',
    port: E2E_TOTP_REQUIRED_PORTS.backend,
  },
  {
    name: 'email-verification',
    testDir: './e2e/tests/email-verification',
    port: E2E_EMAIL_VERIFICATION_PORTS.backend,
  },
  {
    name: 'registration-disabled',
    testDir: './e2e/tests/registration-disabled',
    port: E2E_REGISTRATION_DISABLED_PORTS.backend,
  },
  {
    name: 'terms',
    testDir: './e2e/tests/terms',
    port: E2E_TERMS_PORTS.backend,
  },
  {
    name: 'account-deletion',
    testDir: './e2e/tests/account-deletion',
    port: E2E_ACCOUNT_DELETION_PORTS.backend,
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
  retries: process.env['CI'] ? 2 : 1,
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
