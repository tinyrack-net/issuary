import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `dual-2fa-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  }),
  auth: {
    password: {
      two_factor: { enrollment_required: true },
      totp: { enabled: true },
    },
    passkey: { enabled: true },
  },
}));

test.describe('Dual 2FA selection UI', () => {
  test('new user is routed to setup 2FA selection page', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/2fa');

    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('verify 2FA page shows both enabled methods', async ({ page }) => {
    await page.goto('/verify/2fa');

    await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();
  });

  test('setup 2FA page can route to both setup methods', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup-route');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/2fa');

    await page.locator('a[href^="/setup/totp"]').click();
    await page.waitForURL('**/setup/totp');

    await page.goto('/setup/2fa');
    await page.locator('a[href^="/setup/passkey"]').click();
    await expect(page).toHaveURL(/\/setup\/passkey/);
  });

  test('verify 2FA page can route to both verify methods', async ({ page }) => {
    await page.goto('/verify/2fa');
    await page.locator('a[href^="/verify/totp"]').click();
    await page.waitForURL('**/verify/totp');

    await page.goto('/verify/2fa');
    await page.locator('a[href^="/verify/passkey"]').click();
    await page.waitForURL('**/verify/passkey');
  });
});
