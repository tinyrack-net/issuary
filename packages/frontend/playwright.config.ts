import {
  defineConfig,
  devices,
  type PlaywrightTestProject,
} from '@playwright/test';

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
    name: 'oauth-providers-terms',
    testDir: './e2e/tests/oauth-providers-terms',
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
    name: 'theme-dark-fixed',
    testDir: './e2e/tests/theme-dark-fixed',
  },
  {
    name: 'totp-optional',
    testDir: './e2e/tests/totp-optional',
  },
  {
    name: 'config-managed-profile',
    testDir: './e2e/tests/config-managed-profile',
  },
  {
    name: 'passkey-optional',
    testDir: './e2e/tests/passkey-optional',
  },
  {
    name: 'email-verification-2fa-required',
    testDir: './e2e/tests/email-verification-2fa-required',
  },
  {
    name: 'terms-complete-registration',
    testDir: './e2e/tests/terms-complete-registration',
  },
  {
    name: 'journey-oauth-2fa',
    testDir: './e2e/tests/journey-oauth-2fa',
  },
  {
    name: 'oauth-providers-specific',
    testDir: './e2e/tests/oauth-providers-specific',
  },
  {
    name: 'mock-oauth-client',
    testDir: './e2e/tests/mock-oauth-client',
  },
];

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
];
const includeScreenLab = process.env['ISSUARY_E2E_EXCLUDE_SCREEN_LAB'] !== '1';
const screenLabProject: PlaywrightTestProject = {
  name: 'screen-lab:chromium',
  testDir: './e2e/tests/screen-lab',
  use: {
    colorScheme: 'light',
    locale: 'en-US',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
};

export default defineConfig({
  fullyParallel: true,
  globalSetup: './e2e/setup/global-setup.ts',
  forbidOnly: !!process.env['CI'],
  retries: 0,
  /*
   * Standalone Playwright runs use every available CPU. The root validation
   * command splits that same global budget across isolated shard processes so
   * no single shared Vite server becomes the concurrency bottleneck.
   */
  workers: '100%',
  reporter: 'html',
  /*
   * Budgets are sized for a loaded machine, not an idle one. Raising them costs
   * nothing on a green run — a timeout only bounds how long a failure takes to
   * report — so the headroom is free. Keep them comfortably under `timeout` so
   * a genuinely stuck action still fails with its own message rather than as a
   * whole-test timeout.
   */
  timeout: 1000 * 90,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
  },
  snapshotPathTemplate:
    '{testDir}/{testFilePath}-snapshots/{platform}/{arg}{ext}',
  use: {
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [
    ...configs.flatMap((config) =>
      browsers.map((browser) => ({
        name: `${config.name}:${browser.name}`,
        testDir: config.testDir,
        use: {
          trace: 'retain-on-failure' as const,
          /*
           * Auth screen content animates in, and Playwright waits for an element
           * to stop moving before acting on it. That is correct, but it puts a
           * stability window in front of nearly every interaction in this suite
           * for the sake of decoration. Asking for reduced motion takes the app's
           * own `prefers-reduced-motion` path, so content is final as soon as it
           * mounts.
           */
          reducedMotion: 'reduce' as const,
          ...browser.device,
        },
      })),
    ),
    ...(includeScreenLab ? [screenLabProject] : []),
  ],
});
