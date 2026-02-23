import { expect, test } from '@frontend-e2e/fixtures/dual-2fa.js';
import { performLogin } from '@frontend-e2e/helpers/login.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `dual-2fa-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Dual 2FA selection UI', () => {
  test('new user is routed to setup 2FA selection page', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/2fa');

    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('verify 2FA page shows both enabled methods', async ({ page }) => {
    await page.goto('/verify/2fa');

    await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();
  });
});
