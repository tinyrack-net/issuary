import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { performLogin, totpSetupPage } from '#frontend-e2e/helpers/login.ts';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.ts';
import {
  generateTotpCode,
  interceptTotpSecret,
} from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `totp-setup-${suffix}-${ts}@example.com`;
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
  users: [E2E_TEST_USER_CONFIG],
}));

test.describe('TOTP setup flow (DB user, 2FA required)', () => {
  test('full TOTP setup: QR -> verify -> recovery -> profile', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('full');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

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

  test('TOTP setup: wrong code shows error', async ({ page, baseURL }) => {
    const email = uniqueEmail('wrong-code');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

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

  test('setup 2FA chooser is skipped in TOTP-only required config', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('skip-setup-chooser');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/totp');

    await page.goto('/setup/2fa');
    await expect(page.locator('a[href^="/setup/passkey"]')).toHaveCount(0);

    const isTotpSetupRoute = /\/setup\/totp/.test(page.url());
    if (!isTotpSetupRoute) {
      await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    }
  });
});
