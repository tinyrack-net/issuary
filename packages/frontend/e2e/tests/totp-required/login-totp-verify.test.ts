import { performLogin, totpVerifyPage } from '@frontend-e2e/helpers/login.js';
import { fillPinInput } from '@frontend-e2e/helpers/pin-input.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import {
  generateTotpCode,
  setupTotpViaApi,
} from '@frontend-e2e/helpers/totp.js';
import { expect, test } from '@playwright/test';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `totp-verify-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('TOTP verify flow (DB user with TOTP already set up)', () => {
  let email: string;
  let totpSecret: string;

  test.beforeAll(async ({ request, baseURL }) => {
    email = uniqueEmail('verify');

    // Register user (Playwright request manages cookies automatically)
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    // Set up TOTP via API (3-step flow)
    const result = await setupTotpViaApi(request, String(baseURL));
    totpSecret = result.secret;
  });

  test('TOTP verify succeeds with valid code', async ({ page }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    // Enter valid TOTP code
    const code = generateTotpCode(totpSecret);
    await fillPinInput(page, code);

    // Should navigate to profile
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('TOTP verify: wrong code shows error', async ({ page }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    // Enter wrong code
    await fillPinInput(page, '000000');

    // Should show error
    await expect(page.locator(totpVerifyPage.fieldError).first()).toBeVisible();

    // Should stay on verify page
    await expect(page).toHaveURL(/\/verify\/totp/);
  });

  test('recovery code link is visible on TOTP verify page', async ({
    page,
  }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    await expect(page.locator(totpVerifyPage.recoveryCodeLink)).toBeVisible();
  });
});
