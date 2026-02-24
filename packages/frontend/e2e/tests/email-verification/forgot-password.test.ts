import { expect, test } from '#frontend-e2e/fixtures/email-verification.js';
import { forgotPasswordPage } from '#frontend-e2e/helpers/password-reset.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `forgot-pw-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Forgot password flow', () => {
  test('password login shows forgot password link when SMTP is enabled', async ({
    page,
  }) => {
    await page.goto('/login/password');
    await expect(
      page.getByRole('link', { name: 'Forgot password?' }),
    ).toBeVisible();
  });

  test('submit email shows success view', async ({ page, baseURL }) => {
    const email = uniqueEmail('success');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await page.goto('/password/forgot');

    await page.locator(forgotPasswordPage.emailInput).fill(email);
    await page.locator(forgotPasswordPage.submitButton).click();

    // Success view should appear
    await expect(page.getByText('Email sent!')).toBeVisible();
    await expect(page.getByText('Check your inbox')).toBeVisible();
  });

  test('non-existent email still shows success (no enumeration)', async ({
    page,
  }) => {
    await page.goto('/password/forgot');

    await page
      .locator(forgotPasswordPage.emailInput)
      .fill('nonexistent@example.com');
    await page.locator(forgotPasswordPage.submitButton).click();

    // Should still show success view (security: no email enumeration)
    await expect(page.getByText('Email sent!')).toBeVisible();
  });

  test('back to login link navigates to /login', async ({ page }) => {
    await page.goto('/password/forgot');

    const loginLink = page.getByRole('link', { name: 'Sign in' });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
