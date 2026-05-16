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
  modal,
  profilePage,
  regenerateTotpModal,
} from '#frontend-e2e/helpers/profile-page.ts';
import {
  generateTotpCode,
  interceptRegeneratedRecoveryCodes,
  setupTotpViaTestApi,
  setupTotpWithRecoveryViaTestApi,
} from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `profile-totp-${suffix}`);
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

function extractSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/session=([^;]+)/);
  if (!match?.[1]) {
    throw new Error('Missing session cookie');
  }

  return match[1];
}

async function authenticateWithRecoveryCode(
  baseUrl: string,
  email: string,
  password: string,
  recoveryCode: string,
): Promise<void> {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  const sessionCookie = extractSessionCookie(
    loginRes.headers.get('set-cookie'),
  );
  const verifyRes = await fetch(`${baseUrl}/api/auth/totp/recovery/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session=${sessionCookie}`,
      'Sec-Fetch-Site': 'same-origin',
    },
    body: JSON.stringify({
      code: recoveryCode,
    }),
  });

  if (!verifyRes.ok) {
    throw new Error(`Recovery verification failed: ${verifyRes.status}`);
  }
}

async function exhaustRecoveryCodes(
  baseUrl: string,
  email: string,
  password: string,
  recoveryCodes: string[],
): Promise<void> {
  for (const recoveryCode of recoveryCodes) {
    await authenticateWithRecoveryCode(baseUrl, email, password, recoveryCode);
  }
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

  test('shows a warning when all recovery codes are exhausted', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('recovery-warning');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const { secret, recoveryCodes } = await setupTotpWithRecoveryViaTestApi(
      String(baseURL),
      email,
    );
    await exhaustRecoveryCodes(
      String(baseURL),
      email,
      TEST_PASSWORD,
      recoveryCodes,
    );

    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    await expect(page.locator(profilePage.totpRecoveryWarning)).toBeVisible();
    await expect(
      page.getByText('Recovery codes need to be regenerated'),
    ).toBeVisible();
  });

  test('regenerating recovery codes clears the warning state', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('recovery-regenerate');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const { secret, recoveryCodes } = await setupTotpWithRecoveryViaTestApi(
      String(baseURL),
      email,
    );
    await exhaustRecoveryCodes(
      String(baseURL),
      email,
      TEST_PASSWORD,
      recoveryCodes,
    );

    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    await page.locator(profilePage.totpRegenerateButton).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await fillPinInput(page, generateTotpCode(secret));
    await expect(
      page.locator(regenerateTotpModal.recoveryCodesGrid),
    ).toBeVisible();

    await page.locator(regenerateTotpModal.confirmCheckbox).click();
    await page.locator(regenerateTotpModal.confirmButton).click();

    await expect(page.locator(modal.openModal)).toHaveCount(0);
    await expect(page.locator(profilePage.totpRecoveryWarning)).toHaveCount(0);
  });

  test('invalid TOTP during regeneration stays in the modal with a field error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('recovery-invalid-regenerate');
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

    await page.locator(profilePage.totpRegenerateButton).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await fillPinInput(page, '000000');

    await expect(page.locator(regenerateTotpModal.fieldError)).toBeVisible();
    await expect(page.locator(modal.openModal)).toBeVisible();
  });

  test('old recovery codes are invalidated after regeneration', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('recovery-old-invalidated');
    const base = String(baseURL);
    const client = getTestApiClient({ baseUrl: base });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const { secret, recoveryCodes } = await setupTotpWithRecoveryViaTestApi(
      base,
      email,
    );
    const oldCode = recoveryCodes[0];
    expect(oldCode).toBeTruthy();

    // Log in and regenerate recovery codes
    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    const newCodesPromise = interceptRegeneratedRecoveryCodes(page);

    await page.locator(profilePage.totpRegenerateButton).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await fillPinInput(page, generateTotpCode(secret));
    await expect(
      page.locator(regenerateTotpModal.recoveryCodesGrid),
    ).toBeVisible();

    await newCodesPromise;

    await page.locator(regenerateTotpModal.confirmCheckbox).click();
    await page.locator(regenerateTotpModal.confirmButton).click();
    await expect(page.locator(modal.openModal)).toHaveCount(0);

    // Try to login with the old recovery code — it should fail
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const sessionCookie = extractSessionCookie(
      loginRes.headers.get('set-cookie'),
    );
    const verifyRes = await fetch(`${base}/api/auth/totp/recovery/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
      body: JSON.stringify({ code: String(oldCode) }),
    });

    expect(verifyRes.ok).toBe(false);
  });

  test('new recovery codes work after regeneration', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('recovery-new-work');
    const base = String(baseURL);
    const client = getTestApiClient({ baseUrl: base });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    const { secret } = await setupTotpWithRecoveryViaTestApi(base, email);

    // Log in and regenerate recovery codes
    await loginWithTotpAndGoToProfile(page, email, TEST_PASSWORD, secret);

    const newCodesPromise = interceptRegeneratedRecoveryCodes(page);

    await page.locator(profilePage.totpRegenerateButton).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await fillPinInput(page, generateTotpCode(secret));
    await expect(
      page.locator(regenerateTotpModal.recoveryCodesGrid),
    ).toBeVisible();

    const newCodes = await newCodesPromise;
    expect(newCodes.length).toBeGreaterThan(0);

    await page.locator(regenerateTotpModal.confirmCheckbox).click();
    await page.locator(regenerateTotpModal.confirmButton).click();
    await expect(page.locator(modal.openModal)).toHaveCount(0);

    // Authenticate with the first new recovery code via API
    await authenticateWithRecoveryCode(
      base,
      email,
      TEST_PASSWORD,
      String(newCodes[0]),
    );
  });
});
