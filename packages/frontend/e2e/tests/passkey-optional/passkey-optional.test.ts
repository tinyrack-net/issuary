import { expect, test } from '@frontend-e2e/fixtures/passkey-optional.js';
import { performLogin } from '@frontend-e2e/helpers/login.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { enableVirtualAuthenticator } from '@frontend-e2e/helpers/webauthn.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `passkey-optional-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Passkey optional configuration', () => {
  test('user without passkey logs in directly to profile', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('no-passkey');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

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
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('has-passkey');
      await registerUser(request, String(baseURL), email, TEST_PASSWORD);

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
