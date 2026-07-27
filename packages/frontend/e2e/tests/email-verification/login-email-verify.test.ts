import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { getEmailToken } from '#frontend-e2e/helpers/email-token.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { emailVerifyPage, performLogin } from '#frontend-e2e/helpers/login.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `email-verify-${suffix}`);
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
  email: { test: true },
}));

test.describe('Email verification flow (DB user, email enabled)', () => {
  test('full email verification flow', async ({ page, baseURL }) => {
    const email = uniqueEmail('full');
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

    // Get the token via test endpoint
    const token = await getEmailToken(String(baseURL), email);

    // Fill in the token
    await page.locator('input[name="token"]').fill(token);

    // Submit
    await page.locator(emailVerifyPage.submitButton).click();

    // Should show success
    await expect(page.locator(emailVerifyPage.successAlert)).toBeVisible();

    // Click "Go to Profile"
    await page.locator(emailVerifyPage.goToProfileButton).click();

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('email verification token cannot be reused after success', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('single-use');
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
    await page.locator(emailVerifyPage.tokenInput).fill(token);
    await page.locator(emailVerifyPage.submitButton).click();
    await expect(page.locator(emailVerifyPage.successAlert)).toBeVisible();

    const reuseRes = await request.post(
      `${String(baseURL)}/api/auth/email/verify`,
      {
        data: { token },
      },
    );
    expect(reuseRes.status()).toBe(400);
    await expect(reuseRes.json()).resolves.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  test('email verification: invalid token shows error', async ({
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

    // Enter a wrong token
    await page.locator('input[name="token"]').fill('invalid-token-value');

    await page.locator(emailVerifyPage.submitButton).click();

    // Should show error
    await expect(
      page.locator(emailVerifyPage.fieldError).first(),
    ).toBeVisible();

    // Should stay on verify email page
    await expect(page).toHaveURL(/\/verify\/email/);
  });

  test('resend verification email', async ({ page, baseURL }) => {
    const email = uniqueEmail('resend');
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

    // Click resend button
    await page.locator(emailVerifyPage.resendButton).click();

    // Confirmed with a toast: it is transient feedback, and dismissing it
    // loses nothing the user still needs.
    await expect(page.locator(emailVerifyPage.resendToast)).toBeVisible();
  });
});
