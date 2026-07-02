import { expect, type Page } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import {
  uniqueEmail as createUniqueEmail,
  uniqueTestId,
} from '#frontend-e2e/helpers/identity.ts';
import {
  allowConsentAndExpectRedirect,
  buildAuthEntryUrl,
  buildJourneyOAuthParams,
  expectOAuthParamsPresent,
  type JourneyOAuthParams,
} from '#frontend-e2e/helpers/journey.ts';
import { loginMethodPage, performLogin } from '#frontend-e2e/helpers/login.ts';
import { performRegister } from '#frontend-e2e/helpers/register-page.ts';
import { enableVirtualAuthenticator } from '#frontend-e2e/helpers/webauthn.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `passkey-required-${suffix}`);
}

function uniqueOauthParams(suffix: string): JourneyOAuthParams {
  return buildJourneyOAuthParams(
    uniqueTestId(test.info(), `passkey-required-${suffix}`),
  );
}

async function registerPasskeyFromRequiredSetup(
  page: Page,
  email: string,
): Promise<void> {
  await performRegister(page, email, TEST_PASSWORD);
  await page.waitForURL('**/setup/passkey**');
  await page.waitForURL('**/profile');
}

async function logoutFromProfile(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL('**/login**');
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
    },
    passkey: { enabled: true },
  },
  clients: [E2E_TEST_CLIENT_CONFIG],
}));

test.describe('Passkey-required flow', () => {
  test('registration enters passkey setup and completes to profile', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('register');

      await performRegister(page, email, TEST_PASSWORD);
      await page.waitForURL('**/setup/passkey**');

      await expect(page).toHaveURL(/\/setup\/passkey/);

      await page.waitForURL('**/profile');
      await expect(page).toHaveURL(/\/profile/);
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('user with passkey completes passkey verification on next login', async ({
    page,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('verify');
      const client = getTestApiClient({ baseUrl: String(baseURL) });
      const registerRes = await client.api.auth.register.$post({
        header: {},
        json: { email, password: TEST_PASSWORD },
      });
      if (!registerRes.ok) {
        throw new Error(`Failed to register user: ${registerRes.status}`);
      }

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/setup/passkey**');
      await page.waitForURL('**/profile');

      await page.getByRole('button', { name: 'Log out' }).click();
      await page.waitForURL('**/login**');

      const loginRes = await page.request.post(
        `${String(baseURL)}/api/auth/login`,
        {
          data: {
            email,
            password: TEST_PASSWORD,
          },
        },
      );
      expect(loginRes.ok()).toBeTruthy();

      await page.goto('/verify/passkey');
      await page.waitForURL('**/profile');
      await expect(page).toHaveURL(/\/profile/);
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('user signs in from the login page with a registered passkey', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('ui-login');

      await registerPasskeyFromRequiredSetup(page, email);
      await logoutFromProfile(page);

      await expect(
        page.locator(loginMethodPage.passkeyMethodButton),
      ).toBeVisible();
      await page.locator(loginMethodPage.passkeyMethodButton).click();

      await page.waitForURL('**/profile');
      await expect(page).toHaveURL(/\/profile/);
      await expect(page.getByTestId('profile-user-email')).toHaveText(email);
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('OAuth authorize flow can continue through login page passkey auth', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('oauth-ui-login');
      const oauthParams = uniqueOauthParams('oauth-ui-login');

      await registerPasskeyFromRequiredSetup(page, email);
      await logoutFromProfile(page);

      await page.goto(buildAuthEntryUrl('login', 'method', oauthParams));
      await expectOAuthParamsPresent(page, oauthParams);
      await expect(
        page.locator(loginMethodPage.passkeyMethodButton),
      ).toBeVisible();

      await page.locator(loginMethodPage.passkeyMethodButton).click();

      await page.waitForURL('**/consent**');
      await expectOAuthParamsPresent(page, oauthParams);
      await allowConsentAndExpectRedirect(
        page,
        E2E_TEST_CLIENT.redirectUri,
        oauthParams.state,
      );
    } finally {
      await virtualAuth.teardown();
    }
  });
});
