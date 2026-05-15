import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin, totpVerifyPage } from '#frontend-e2e/helpers/login.ts';
import { recoveryPage } from '#frontend-e2e/helpers/recovery.ts';
import { setupTotpWithRecoveryViaTestApi } from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `totp-recovery-${suffix}`);
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

test.describe('TOTP recovery code verification', () => {
  let email: string;
  let recoveryCodes: string[];

  test.beforeAll(async ({ baseURL }) => {
    email = uniqueEmail('recovery');

    // Register user
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    // Set up TOTP and capture recovery codes via test endpoint
    const result = await setupTotpWithRecoveryViaTestApi(
      String(baseURL),
      email,
    );
    recoveryCodes = result.recoveryCodes;
  });

  test('valid recovery code succeeds and navigates to profile', async ({
    page,
  }) => {
    // Login
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    // Click "Use a recovery code" link
    await page.locator(totpVerifyPage.recoveryCodeLink).click();
    await page.waitForURL('**/verify/totp/recovery');

    // Enter first recovery code
    const code = recoveryCodes[0];
    expect(code).toBeTruthy();
    await page.locator(recoveryPage.codeInput).fill(String(code));
    await page.locator(recoveryPage.submitButton).click();

    // Should navigate to profile
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('used recovery code cannot be reused', async ({ page }) => {
    const code = recoveryCodes[1];
    expect(code).toBeTruthy();

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');
    await page.locator(totpVerifyPage.recoveryCodeLink).click();
    await page.waitForURL('**/verify/totp/recovery');
    await page.locator(recoveryPage.codeInput).fill(String(code));
    await page.locator(recoveryPage.submitButton).click();
    await page.waitForURL('**/profile');

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');
    await page.locator(totpVerifyPage.recoveryCodeLink).click();
    await page.waitForURL('**/verify/totp/recovery');
    await page.locator(recoveryPage.codeInput).fill(String(code));
    await page.locator(recoveryPage.submitButton).click();

    await expect(page.locator(recoveryPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/verify\/totp\/recovery/);
  });

  test('invalid recovery code shows error', async ({ page }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    await page.locator(totpVerifyPage.recoveryCodeLink).click();
    await page.waitForURL('**/verify/totp/recovery');

    // Enter invalid recovery code
    await page.locator(recoveryPage.codeInput).fill('ABCD-EFGH-JKLM-NPQR');
    await page.locator(recoveryPage.submitButton).click();

    // Should show error
    await expect(page.locator(recoveryPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/verify\/totp\/recovery/);
  });

  test('"back to authenticator" link navigates to /verify/totp', async ({
    page,
  }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    await page.locator(totpVerifyPage.recoveryCodeLink).click();
    await page.waitForURL('**/verify/totp/recovery');

    // Click "back to authenticator" link
    await page.locator(recoveryPage.backToTotpLink).click();

    await page.waitForURL('**/verify/totp');
    await expect(page).toHaveURL(/\/verify\/totp$/);
  });
});
