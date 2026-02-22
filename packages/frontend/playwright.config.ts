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
];

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
];

export default defineConfig({
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
        trace: 'on-first-retry' as const,
        ...browser.device,
      },
    })),
  ),
});
