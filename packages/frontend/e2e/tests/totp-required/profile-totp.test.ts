import { expect, test } from '#frontend-e2e/fixtures/totp-required.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.js';
import { disableTotpModal, modal } from '#frontend-e2e/helpers/profile-page.js';
import {
  generateTotpCode,
  setupTotpViaTestApi,
} from '#frontend-e2e/helpers/totp.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `profile-totp-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

/**
 * Logs in with TOTP verification and navigates to profile.
 */
async function loginWithTotpAndGoToProfile(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  totpSecret: string,
): Promise<void> {
  await performLogin(page, email, password);
  await page.waitForURL('**/verify/totp');

  const code = generateTotpCode(totpSecret);
  await fillPinInput(page, code);

  await page.waitForURL('**/profile');
}

test.describe('Profile TOTP management (2FA required)', () => {
  test('profile shows TOTP as enabled after setup', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('show-enabled');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const { secret } = await setupTotpViaTestApi(String(baseURL), email);

    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    // TOTP section should show "enabled"
    await expect(
      page.getByText('Two-factor authentication is enabled'),
    ).toBeVisible();

    // "Disable" button should be visible
    await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
  });

  test('disable TOTP with wrong code shows error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('disable-err');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const { secret } = await setupTotpViaTestApi(String(baseURL), email);

    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Enter wrong TOTP code
    await page.locator(disableTotpModal.codeInput).fill('000000');

    // Click the "Disable" button inside the modal
    await page.locator(disableTotpModal.submitButton).click();

    // Should show error
    await expect(
      page.locator(disableTotpModal.fieldError).first(),
    ).toBeVisible();
  });

  test('cannot disable TOTP when it is the only second factor', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('cant-disable');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    const { secret } = await setupTotpViaTestApi(String(baseURL), email);

    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Enter valid TOTP code
    const code = generateTotpCode(secret);
    await page.locator(disableTotpModal.codeInput).fill(code);
    await page.locator(disableTotpModal.submitButton).click();

    // Should show "cannot remove last second factor" error
    await expect(page.getByText('Cannot disable TOTP')).toBeVisible();
  });
});
