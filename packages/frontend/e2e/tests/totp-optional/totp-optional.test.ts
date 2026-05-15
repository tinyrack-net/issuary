import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.ts';
import {
  generateTotpCode,
  setupTotpViaTestApi,
} from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `totp-optional-${suffix}`);
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
      totp: { enabled: true },
    },
  },
}));

test.describe('TOTP optional configuration', () => {
  test('user without TOTP logs in directly to profile', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('no-totp');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/profile');

    await expect(page).toHaveURL(/\/profile/);
  });

  test('user with TOTP is routed to verify flow', async ({ page, baseURL }) => {
    const email = uniqueEmail('has-totp');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const { secret } = await setupTotpViaTestApi(String(baseURL), email);

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');
    await expect(page).toHaveURL(/\/verify\/totp/);

    const code = generateTotpCode(secret);
    await fillPinInput(page, code);
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('setup and verify 2FA pages only show TOTP option', async ({ page }) => {
    await page.goto('/setup/2fa');
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toHaveCount(0);

    await page.goto('/verify/2fa');
    await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/passkey"]')).toHaveCount(0);
  });

  test('direct passkey setup route shows guarded setup screen', async ({
    page,
  }) => {
    await page.goto('/setup/passkey');
    await expect(
      page.getByRole('heading', { name: 'Set Up Passkey' }),
    ).toBeVisible();
    await expect(
      page.getByText('Two-factor authentication is required to continue'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to login' }),
    ).toBeVisible();
  });
});
