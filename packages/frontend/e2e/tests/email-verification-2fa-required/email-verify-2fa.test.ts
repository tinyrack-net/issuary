import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { getEmailToken } from '#frontend-e2e/helpers/email-token.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';
import { performRegister } from '#frontend-e2e/helpers/register-page.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `email-verify-2fa-${suffix}-${ts}@example.com`;
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
  email: { test: true },
}));

test.describe('Email verification with required 2FA', () => {
  test('registration verification continues to setup 2FA selection', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('register');
    await performRegister(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/email**');

    const token = await getEmailToken(String(baseURL), email);
    await page.locator('input[name="token"]').fill(token);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/setup/2fa**');
    await expect(page).toHaveURL(/\/setup\/2fa/);
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('login verification continues to setup 2FA selection', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('login');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/email**');

    const token = await getEmailToken(String(baseURL), email);
    await page.locator('input[name="token"]').fill(token);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/setup/2fa**');
    await expect(page).toHaveURL(/\/setup\/2fa/);
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('invalid token keeps user on verify-email and blocks 2FA setup', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('invalid-token');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/email**');

    await page.locator('input[name="token"]').fill('invalid-token-value');
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('[data-testid="field-error"]').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/verify\/email/);
  });
});
