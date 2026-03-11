import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestAppConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';
import { performRegister } from '#frontend-e2e/helpers/register-page.js';
import { enableVirtualAuthenticator } from '#frontend-e2e/helpers/webauthn.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `passkey-required-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  app: createTestAppConfig(backendPort, {
    allowed_signup_emails: ['*'],
  }),
  auth: {
    password: {
      second_factor: { required: true },
    },
    passkey: { enabled: true },
  },
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
      await page.waitForURL('**/login');

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
});
