import { type APIRequestContext, expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { getEmailToken } from '#frontend-e2e/helpers/email-token.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import {
  loginPasswordPage,
  performLogin,
} from '#frontend-e2e/helpers/login.ts';
import {
  getPasswordResetToken,
  resetPasswordPage,
} from '#frontend-e2e/helpers/password-reset.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `reset-pw-${suffix}`);
}

const TEST_PASSWORD = 'test-password-123';
const NEW_PASSWORD = 'new-password-456';

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

/**
 * Requests a password reset and retrieves the token via test endpoint.
 */
async function requestResetToken(
  page: import('@playwright/test').Page,
  baseURL: string,
  email: string,
): Promise<string> {
  // Request forgot password via API
  await page.request.post(`${baseURL}/api/auth/password/forgot`, {
    data: { email },
  });

  // Get the token from test endpoint
  return getPasswordResetToken(baseURL, email);
}

async function verifyEmail(
  request: APIRequestContext,
  baseURL: string,
  email: string,
): Promise<void> {
  const token = await getEmailToken(baseURL, email);
  const verifyRes = await request.post(`${baseURL}/api/auth/email/verify`, {
    data: { token },
  });

  expect(verifyRes.ok()).toBe(true);
}

test.describe('Reset password flow', () => {
  test('full flow: forgot -> token -> reset -> success', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('full-flow');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await verifyEmail(request, String(baseURL), email);

    // Request password reset
    const token = await requestResetToken(page, String(baseURL), email);

    // Navigate to reset page with token
    await page.goto(`/password/reset?token=${token}`);

    // Fill in new password
    await page.locator(resetPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page
      .locator(resetPasswordPage.confirmPasswordInput)
      .fill(NEW_PASSWORD);

    // Submit
    await page.locator(resetPasswordPage.submitButton).click();

    // Success view should appear
    await expect(page.getByText('Password reset!')).toBeVisible();

    await performLogin(page, email, TEST_PASSWORD);
    await expect(
      page.locator(loginPasswordPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\/password/);

    await page.locator(loginPasswordPage.emailInput).fill(email);
    await page.locator(loginPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page.locator(loginPasswordPage.submitButton).click();
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('password reset token cannot be reused after success', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('token-single-use');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const token = await requestResetToken(page, String(baseURL), email);
    await page.goto(`/password/reset?token=${token}`);
    await page.locator(resetPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page
      .locator(resetPasswordPage.confirmPasswordInput)
      .fill(NEW_PASSWORD);
    await page.locator(resetPasswordPage.submitButton).click();
    await expect(page.getByText('Password reset!')).toBeVisible();

    const reuseRes = await request.post(
      `${String(baseURL)}/api/auth/password/reset`,
      {
        data: {
          token,
          password: 'another-password-789',
        },
      },
    );
    expect(reuseRes.status()).toBe(400);
    await expect(reuseRes.json()).resolves.toMatchObject({
      code: 'INVALID_PASSWORD_RESET_TOKEN',
    });
  });

  test('invalid token shows error', async ({ page }) => {
    await page.goto('/password/reset?token=invalid-token-123');

    await page.locator(resetPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page
      .locator(resetPasswordPage.confirmPasswordInput)
      .fill(NEW_PASSWORD);
    await page.locator(resetPasswordPage.submitButton).click();

    // Should show token error
    await expect(
      page.locator(resetPasswordPage.tokenError).first(),
    ).toBeVisible();
  });

  test('password mismatch shows validation error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('mismatch');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const token = await requestResetToken(page, String(baseURL), email);

    await page.goto(`/password/reset?token=${token}`);

    await page.locator(resetPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page
      .locator(resetPasswordPage.confirmPasswordInput)
      .fill('different-password');

    await page.locator(resetPasswordPage.submitButton).click();

    // Validation error for mismatch
    await expect(
      page.locator(resetPasswordPage.fieldError).first(),
    ).toBeVisible();
  });

  test('short password shows validation error', async ({ page, baseURL }) => {
    const email = uniqueEmail('short');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const token = await requestResetToken(page, String(baseURL), email);

    await page.goto(`/password/reset?token=${token}`);

    await page.locator(resetPasswordPage.passwordInput).fill('abc');
    await page.locator(resetPasswordPage.confirmPasswordInput).fill('abc');

    await page.locator(resetPasswordPage.submitButton).click();

    // Validation error for short password
    await expect(
      page.locator(resetPasswordPage.fieldError).first(),
    ).toBeVisible();
  });

  test('success view has go to login button', async ({ page, baseURL }) => {
    const email = uniqueEmail('go-to-login');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const token = await requestResetToken(page, String(baseURL), email);

    await page.goto(`/password/reset?token=${token}`);

    await page.locator(resetPasswordPage.passwordInput).fill(NEW_PASSWORD);
    await page
      .locator(resetPasswordPage.confirmPasswordInput)
      .fill(NEW_PASSWORD);
    await page.locator(resetPasswordPage.submitButton).click();

    // Wait for success view
    await expect(page.getByText('Password reset!')).toBeVisible();

    // Click "Go to login" button
    await page.getByRole('button', { name: 'Go to login' }).click();

    // Should navigate to login
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
