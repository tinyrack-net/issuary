import { expect, test } from '@frontend-e2e/fixtures/email-verification.js';
import { getEmailToken } from '@frontend-e2e/helpers/email-token.js';
import { emailVerifyPage } from '@frontend-e2e/helpers/login.js';
import { performRegister } from '@frontend-e2e/helpers/register-page.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `register-email-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Registration + email verification flow', () => {
  test('full registration then email verification to profile', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('full');
    await performRegister(page, email, TEST_PASSWORD);

    // Should redirect to email verification page
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
});
