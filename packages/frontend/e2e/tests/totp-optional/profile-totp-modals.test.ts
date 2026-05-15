import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';
import { fillPinInput } from '#frontend-e2e/helpers/pin-input.ts';
import {
  disableTotpModal,
  loginAndGoToProfile,
  modal,
  setupTotpModal,
} from '#frontend-e2e/helpers/profile-page.ts';
import {
  generateTotpCode,
  interceptTotpSecret,
  setupTotpViaTestApi,
} from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `profile-totp-modal-${suffix}`);
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
      totp: { enabled: true },
    },
  },
}));

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

test.describe('SetupTotpModal (profile)', () => {
  test('opens modal with QR code on Enable click', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup-qr');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // TOTP should show as not enabled
    await expect(
      page.getByText('Two-factor authentication is not enabled'),
    ).toBeVisible();

    // Start intercepting TOTP secret before clicking
    const secretPromise = interceptTotpSecret(page);

    // Click Enable button
    await page.getByRole('button', { name: 'Enable' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // QR code image should be visible
    await expect(page.locator(setupTotpModal.qrCodeImage)).toBeVisible();

    // Wait for secret to be captured
    const secret = await secretPromise;
    expect(secret).toBeTruthy();
  });

  test('Next button progresses to PIN entry step', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup-next');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const secretPromise = interceptTotpSecret(page);
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.locator(setupTotpModal.qrCodeImage)).toBeVisible();
    await secretPromise;

    // Click Next button
    await page.locator(setupTotpModal.nextButton).click();

    // Should show PIN input
    await expect(page.locator(setupTotpModal.pinInput).first()).toBeVisible();
  });

  test('valid TOTP code shows recovery codes', async ({ page, baseURL }) => {
    const email = uniqueEmail('setup-recovery');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const secretPromise = interceptTotpSecret(page);
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.locator(setupTotpModal.qrCodeImage)).toBeVisible();
    const secret = await secretPromise;

    // Proceed to verify step
    await page.locator(setupTotpModal.nextButton).click();
    await expect(page.locator(setupTotpModal.pinInput).first()).toBeVisible();

    // Enter valid TOTP code
    const code = generateTotpCode(secret);
    await fillPinInput(page, code);

    // Recovery codes grid should appear
    await expect(page.locator(setupTotpModal.recoveryCodesGrid)).toBeVisible();
  });

  test('invalid TOTP code shows error', async ({ page, baseURL }) => {
    const email = uniqueEmail('setup-invalid');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const secretPromise = interceptTotpSecret(page);
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.locator(setupTotpModal.qrCodeImage)).toBeVisible();
    await secretPromise;

    // Proceed to verify step
    await page.locator(setupTotpModal.nextButton).click();
    await expect(page.locator(setupTotpModal.pinInput).first()).toBeVisible();

    // Enter invalid code
    await fillPinInput(page, '000000');

    // Should show error
    await expect(page.getByText('Invalid code')).toBeVisible();
  });

  test('full setup flow: QR -> verify -> recovery -> confirm', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup-full');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const secretPromise = interceptTotpSecret(page);
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.locator(setupTotpModal.qrCodeImage)).toBeVisible();
    const secret = await secretPromise;

    // Step 1: QR -> Next
    await page.locator(setupTotpModal.nextButton).click();
    await expect(page.locator(setupTotpModal.pinInput).first()).toBeVisible();

    // Step 2: Verify with valid code
    const code = generateTotpCode(secret);
    await fillPinInput(page, code);

    // Step 3: Recovery codes
    await expect(page.locator(setupTotpModal.recoveryCodesGrid)).toBeVisible();

    // Check confirmation checkbox
    await page.locator(setupTotpModal.confirmCheckbox).check();

    // Click confirm button
    await page.locator(setupTotpModal.confirmButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Profile should now show TOTP as enabled
    await expect(
      page.getByText('Two-factor authentication is enabled'),
    ).toBeVisible();

    // Disable button should be visible
    await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
  });

  test('cancel closes modal without setting up TOTP', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup-cancel');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const secretPromise = interceptTotpSecret(page);
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();
    await secretPromise;

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // TOTP should still be not enabled
    await expect(
      page.getByText('Two-factor authentication is not enabled'),
    ).toBeVisible();
  });
});

test.describe('DisableTotpModal (profile, optional 2FA)', () => {
  test('successfully disable TOTP and next login does not require TOTP', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('disable-ok');
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

    // Verify TOTP is enabled
    await expect(
      page.getByText('Two-factor authentication is enabled'),
    ).toBeVisible();

    // Click Disable
    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Warning should be visible
    await expect(page.locator(disableTotpModal.warningAlert)).toBeVisible();

    // Enter valid TOTP code
    const code = generateTotpCode(secret);
    await page.locator(disableTotpModal.codeInput).fill(code);
    await page.locator(disableTotpModal.submitButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // TOTP should now show as not enabled
    await expect(
      page.getByText('Two-factor authentication is not enabled'),
    ).toBeVisible();

    // Enable button should be visible again
    await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/profile');
    await expect(page.getByText(email).first()).toBeVisible();
  });

  test('cancel closes modal without disabling', async ({ page, baseURL }) => {
    const email = uniqueEmail('disable-cancel');
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

    // Click Cancel
    await page.locator(disableTotpModal.cancelButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // TOTP should still be enabled
    await expect(
      page.getByText('Two-factor authentication is enabled'),
    ).toBeVisible();
  });
});
