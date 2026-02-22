import { expect, test } from '@frontend-e2e/fixtures/totp-optional.js';
import { performLogin } from '@frontend-e2e/helpers/login.js';
import { fillPinInput } from '@frontend-e2e/helpers/pin-input.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import {
  generateTotpCode,
  setupTotpViaApi,
} from '@frontend-e2e/helpers/totp.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `totp-optional-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('TOTP optional configuration', () => {
  test('user without TOTP logs in directly to profile', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('no-totp');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/profile');

    await expect(page).toHaveURL(/\/profile/);
  });

  test('user with TOTP is routed to verify flow', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('has-totp');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    const { secret } = await setupTotpViaApi(request, String(baseURL));

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');
    await expect(page).toHaveURL(/\/verify\/totp/);

    const code = generateTotpCode(secret);
    await fillPinInput(page, code);
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('setup and verify 2FA pages only show TOTP option', async ({ page }) => {
    await page.goto('/setup/2fa');
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toHaveCount(0);

    await page.goto('/verify/2fa');
    await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/passkey"]')).toHaveCount(0);
  });
});
