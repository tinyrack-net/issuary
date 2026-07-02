import { expect, type Page, type TestInfo } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';
import { setupPasskeyViaTestApi } from '#frontend-e2e/helpers/passkey.ts';
import { setupTotpViaTestApi } from '#frontend-e2e/helpers/totp.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const TEST_PASSWORD = 'test-password-123';
const TOTP_FALLBACK_LINK = 'Use authenticator app';
const PASSKEY_RETRY_BUTTON = 'Try again';

type FactorSetup = {
  totp?: boolean;
  passkey?: boolean;
};

function buildDualSecondFactorConfig(
  backendPort: number,
  enrollmentRequired: boolean,
) {
  return {
    ...E2E_BASE_CONFIG,
    ...createTestConfig(backendPort, {
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
    }),
    auth: {
      password: {
        two_factor: { enrollment_required: enrollmentRequired },
        totp: { enabled: true },
      },
      passkey: { enabled: true },
    },
  };
}

function uniqueEmail(testInfo: TestInfo, suffix: string): string {
  return createUniqueEmail(testInfo, `dual-2fa-matrix-${suffix}`);
}

async function registerUserWithFactors(
  baseURL: string,
  email: string,
  factors: FactorSetup,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: { email, password: TEST_PASSWORD },
  });
  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }

  if (factors.totp) {
    await setupTotpViaTestApi(baseURL, email);
  }
  if (factors.passkey) {
    await setupPasskeyViaTestApi(baseURL, email);
  }
}

async function mockPasskeyOptionsFailure(page: Page): Promise<void> {
  await page.route('**/api/auth/passkey/options', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PASSKEY_VERIFICATION_FAILED',
        message: 'Passkey verification failed.',
      }),
    });
  });
}

function waitForSecondFactorMethods(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/2fa/methods') &&
      response.status() === 200,
  );
}

async function expectPasskeyFailureWithoutTotpFallback(
  page: Page,
  methodsResponse: Promise<unknown>,
): Promise<void> {
  await expect(
    page.getByRole('button', { name: PASSKEY_RETRY_BUTTON }),
  ).toBeVisible();
  await methodsResponse;
  await expect(
    page.getByRole('link', { name: TOTP_FALLBACK_LINK }),
  ).toHaveCount(0);
}

async function expectPasskeyFailureWithTotpFallback(
  page: Page,
  methodsResponse: Promise<unknown>,
): Promise<void> {
  await expect(
    page.getByRole('button', { name: PASSKEY_RETRY_BUTTON }),
  ).toBeVisible();
  await methodsResponse;
  await expect(
    page.getByRole('link', { name: TOTP_FALLBACK_LINK }),
  ).toBeVisible();
}

const requiredTest = createScenarioFixture((backendPort) =>
  buildDualSecondFactorConfig(backendPort, true),
);

requiredTest.describe('Dual 2FA matrix - enrollment required', () => {
  requiredTest.describe.configure({ mode: 'serial' });

  requiredTest(
    'no registered factors routes to method setup choice',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(requiredTest.info(), 'required-none');
      await registerUserWithFactors(String(baseURL), email, {});

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/setup/2fa');

      await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
      await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
    },
  );

  requiredTest(
    'TOTP-only user routes directly to TOTP verification',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(requiredTest.info(), 'required-totp');
      await registerUserWithFactors(String(baseURL), email, { totp: true });

      await performLogin(page, email, TEST_PASSWORD);

      await page.waitForURL('**/verify/totp');
      await expect(
        page.locator('input[inputMode="numeric"]').first(),
      ).toBeVisible();
    },
  );

  requiredTest(
    'passkey-only user stays on passkey failure screen',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(requiredTest.info(), 'required-passkey');
      await registerUserWithFactors(String(baseURL), email, { passkey: true });
      await mockPasskeyOptionsFailure(page);
      const methodsResponse = waitForSecondFactorMethods(page);

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/verify/passkey');

      await expectPasskeyFailureWithoutTotpFallback(page, methodsResponse);
    },
  );

  requiredTest(
    'user with both factors can choose TOTP after passkey failure',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(requiredTest.info(), 'required-both');
      await registerUserWithFactors(String(baseURL), email, {
        totp: true,
        passkey: true,
      });

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/verify/2fa');
      await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
      await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();

      await mockPasskeyOptionsFailure(page);
      const methodsResponse = waitForSecondFactorMethods(page);
      await page.locator('a[href^="/verify/passkey"]').click();
      await page.waitForURL('**/verify/passkey');

      await expectPasskeyFailureWithTotpFallback(page, methodsResponse);
      await page.getByRole('link', { name: TOTP_FALLBACK_LINK }).click();
      await page.waitForURL('**/verify/totp');
    },
  );
});

const optionalTest = createScenarioFixture((backendPort) =>
  buildDualSecondFactorConfig(backendPort, false),
);

optionalTest.describe('Dual 2FA matrix - enrollment optional', () => {
  optionalTest.describe.configure({ mode: 'serial' });

  optionalTest(
    'no registered factors signs in without 2FA',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(optionalTest.info(), 'optional-none');
      await registerUserWithFactors(String(baseURL), email, {});

      await performLogin(page, email, TEST_PASSWORD);

      await page.waitForURL('**/profile');
    },
  );

  optionalTest(
    'TOTP-only user routes directly to TOTP verification',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(optionalTest.info(), 'optional-totp');
      await registerUserWithFactors(String(baseURL), email, { totp: true });

      await performLogin(page, email, TEST_PASSWORD);

      await page.waitForURL('**/verify/totp');
      await expect(
        page.locator('input[inputMode="numeric"]').first(),
      ).toBeVisible();
    },
  );

  optionalTest(
    'passkey-only user stays on passkey failure screen',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(optionalTest.info(), 'optional-passkey');
      await registerUserWithFactors(String(baseURL), email, { passkey: true });
      await mockPasskeyOptionsFailure(page);
      const methodsResponse = waitForSecondFactorMethods(page);

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/verify/passkey');

      await expectPasskeyFailureWithoutTotpFallback(page, methodsResponse);
    },
  );

  optionalTest(
    'user with both factors can choose TOTP after passkey failure',
    async ({ page, baseURL }) => {
      const email = uniqueEmail(optionalTest.info(), 'optional-both');
      await registerUserWithFactors(String(baseURL), email, {
        totp: true,
        passkey: true,
      });

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/verify/2fa');
      await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
      await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();

      await mockPasskeyOptionsFailure(page);
      const methodsResponse = waitForSecondFactorMethods(page);
      await page.locator('a[href^="/verify/passkey"]').click();
      await page.waitForURL('**/verify/passkey');

      await expectPasskeyFailureWithTotpFallback(page, methodsResponse);
      await page.getByRole('link', { name: TOTP_FALLBACK_LINK }).click();
      await page.waitForURL('**/verify/totp');
    },
  );
});
