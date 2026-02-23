import { expect, test } from '@frontend-e2e/fixtures/email-verification.js';
import { getEmailToken } from '@frontend-e2e/helpers/email-token.js';
import { emailVerifyPage, performLogin } from '@frontend-e2e/helpers/login.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `email-verify-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Email verification flow (DB user, SMTP enabled)', () => {
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

    // Should show success alert for resend
    await expect(page.locator(emailVerifyPage.successAlert)).toBeVisible();
  });
});
