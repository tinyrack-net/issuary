import {
  getPasswordResetToken,
  resetPasswordPage,
} from '@frontend-e2e/helpers/password-reset.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { expect, test } from '@playwright/test';

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
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('full-flow');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

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
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('mismatch');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
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

  test('short password shows validation error', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('short');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
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

  test('success view has go to login button', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('go-to-login');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
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
