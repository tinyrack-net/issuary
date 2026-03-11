import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestAppConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';
import { enableVirtualAuthenticator } from '#frontend-e2e/helpers/webauthn.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `passkey-optional-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  app: createTestAppConfig(backendPort, {
    allowed_signup_emails: ['*'],
  }),
  auth: {
    passkey: { enabled: true },
  },
}));

test.describe('Passkey optional configuration', () => {
  test('user without passkey logs in directly to profile', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('no-passkey');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('setup and verify 2FA pages only show passkey option', async ({
    page,
  }) => {
    await page.goto('/setup/2fa');
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/totp"]')).toHaveCount(0);

    await page.goto('/verify/2fa');
    await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/totp"]')).toHaveCount(0);
  });

  test('user can register a passkey from profile', async ({
    page,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('has-passkey');
      const client = getTestApiClient({ baseUrl: String(baseURL) });
      const registerRes = await client.api.auth.register.$post({
        header: {},
        json: { email, password: TEST_PASSWORD },
      });
      if (!registerRes.ok) {
        throw new Error(`Failed to register user: ${registerRes.status}`);
      }

      await performLogin(page, email, TEST_PASSWORD);
      await page.waitForURL('**/profile');

      await page.goto('/setup/passkey?passkey_name=default');
      await page.waitForURL('**/profile');
      await expect(page).toHaveURL(/\/profile/);
      await expect(page.getByText('Passkeys')).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });
});
