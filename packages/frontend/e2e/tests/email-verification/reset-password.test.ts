import { expect, test } from '@frontend-e2e/fixtures/email-verification.js';
import {
  getPasswordResetToken,
  resetPasswordPage,
} from '@frontend-e2e/helpers/password-reset.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `reset-pw-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';
const NEW_PASSWORD = 'new-password-456';

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

test.describe('Reset password flow', () => {
  test('full flow: forgot -> token -> reset -> success', async ({
    page,
    baseURL,
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
