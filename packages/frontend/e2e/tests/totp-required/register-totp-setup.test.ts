import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { totpSetupPage } from '#frontend-e2e/helpers/login.ts';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.ts';
import { performRegister } from '#frontend-e2e/helpers/register-page.ts';
import {
  generateTotpCode,
  interceptTotpSecret,
} from '#frontend-e2e/helpers/totp.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `register-totp-${suffix}-${ts}@example.com`;
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
  auth: {
    password: {
      two_factor: { enrollment_required: true },
      totp: { enabled: true },
    },
  },
}));

test.describe('Registration + TOTP setup flow', () => {
  test('registration redirects to TOTP setup and completes to profile', async ({
    page,
  }) => {
    const email = uniqueEmail('full');

    // Intercept the TOTP setup response to capture the secret
    const secretPromise = interceptTotpSecret(page);

    await performRegister(page, email, TEST_PASSWORD);

    // Should redirect to TOTP setup
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
});
