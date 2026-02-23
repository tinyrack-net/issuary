import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import { expect, test } from '@frontend-e2e/fixtures/totp-required.js';
import { performLogin, totpSetupPage } from '@frontend-e2e/helpers/login.js';
import { fillPinInput } from '@frontend-e2e/helpers/pin-input.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import {
  generateTotpCode,
  interceptTotpSecret,
} from '@frontend-e2e/helpers/totp.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `totp-setup-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('TOTP setup flow (DB user, 2FA required)', () => {
  test('full TOTP setup: QR -> verify -> recovery -> profile', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('full');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    // Intercept the TOTP setup response to capture the secret
    const secretPromise = interceptTotpSecret(page);

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/totp');

    // QR step: wait for QR code to appear
    await expect(page.locator(totpSetupPage.qrCodeImage)).toBeVisible();

    const secret = await secretPromise;

    // Click Next to go to verify step
    await page.locator(totpSetupPage.nextButton).click();

    // Verify step: enter valid TOTP code
    const code = generateTotpCode(secret);
    await fillPinInput(page, code);

    // Recovery codes step: wait for grid to appear
    await expect(page.locator(totpSetupPage.recoveryCodesGrid)).toBeVisible();

    // Check the confirmation checkbox
    await page.locator(totpSetupPage.confirmCheckbox).check();

    // Click confirm button
    await page.locator(totpSetupPage.confirmButton).click();

    // Should navigate to profile
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('TOTP setup: wrong code shows error', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('wrong-code');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    // Intercept secret but don't use it -- enter wrong code
    interceptTotpSecret(page);

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/totp');

    await expect(page.locator(totpSetupPage.qrCodeImage)).toBeVisible();

    // Click Next
    await page.locator(totpSetupPage.nextButton).click();

    // Enter wrong code
    await fillPinInput(page, '000000');

    // Should show error
    await expect(
      page.locator('[data-testid="pin-input-error"]').first(),
    ).toBeVisible();

    // Should stay on setup page
    await expect(page).toHaveURL(/\/setup\/totp/);
  });

  test('config user bypasses TOTP requirement', async ({ page }) => {
    await performLogin(page, E2E_TEST_USER.email, E2E_TEST_USER.password);

    // Config users have second_factor_required: false, so they go
    // directly to profile without TOTP setup
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });
});
