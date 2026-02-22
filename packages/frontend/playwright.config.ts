import { defineConfig, devices } from '@playwright/test';

const configs = [
  {
    name: 'minimal',
    testDir: './e2e/tests/minimal',
  },
  {
    name: 'totp-required',
    testDir: './e2e/tests/totp-required',
  },
  {
    name: 'email-verification',
    testDir: './e2e/tests/email-verification',
  },
  {
    name: 'registration-disabled',
    testDir: './e2e/tests/registration-disabled',
  },
  {
    name: 'terms',
    testDir: './e2e/tests/terms',
  },
  {
    name: 'account-deletion',
    testDir: './e2e/tests/account-deletion',
  },
  {
    name: 'passkey-required',
    testDir: './e2e/tests/passkey-required',
  },
  {
    name: 'dual-2fa',
    testDir: './e2e/tests/dual-2fa',
  },
  {
    name: 'password-disabled',
    testDir: './e2e/tests/password-disabled',
  },
  {
    name: 'account-deletion-disabled',
    testDir: './e2e/tests/account-deletion-disabled',
  },
  {
    name: 'oauth-providers',
    testDir: './e2e/tests/oauth-providers',
  },
  {
    name: 'oauth-providers-mixed',
    testDir: './e2e/tests/oauth-providers-mixed',
  },
  {
    name: 'ui-branding-locale-theme',
    testDir: './e2e/tests/ui-branding-locale-theme',
  },
  {
    name: 'theme-system-multilang',
    testDir: './e2e/tests/theme-system-multilang',
  },
  {
    name: 'totp-optional',
    testDir: './e2e/tests/totp-optional',
  },
  {
    name: 'config-managed-profile',
    testDir: './e2e/tests/config-managed-profile',
  },
];

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
];

export default defineConfig({
  fullyParallel: true,
  globalSetup: './e2e/setup/global-setup.ts',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 1,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  timeout: 1000 * 60,
  projects: configs.flatMap((config) =>
    browsers.map((browser) => ({
      name: `${config.name}:${browser.name}`,
      testDir: config.testDir,
      use: {
        trace: 'on-first-retry' as const,
        ...browser.device,
      },
    })),
  ),
});
