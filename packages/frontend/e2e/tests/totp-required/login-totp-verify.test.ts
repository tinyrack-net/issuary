import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin, totpVerifyPage } from '#frontend-e2e/helpers/login.ts';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.ts';
import {
  generateTotpCode,
  setupTotpViaTestApi,
} from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `totp-verify-${suffix}`);
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

test.describe('TOTP verify flow (DB user with TOTP already set up)', () => {
  let email: string;
  let totpSecret: string;

  test.beforeAll(async ({ baseURL }) => {
    email = uniqueEmail('verify');

    // Register user
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    // Set up TOTP via test endpoint (no session required)
    const result = await setupTotpViaTestApi(String(baseURL), email);
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
