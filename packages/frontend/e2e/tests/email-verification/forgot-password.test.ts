import { forgotPasswordPage } from '@frontend-e2e/helpers/password-reset.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { expect, test } from '@playwright/test';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `forgot-pw-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Forgot password flow', () => {
  test('submit email shows success view', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('success');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

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
