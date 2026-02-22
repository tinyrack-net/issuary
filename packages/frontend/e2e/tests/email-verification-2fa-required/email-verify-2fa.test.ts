import {
  expect,
  test,
} from '@frontend-e2e/fixtures/email-verification-2fa-required.js';
import { getEmailToken } from '@frontend-e2e/helpers/email-token.js';
import { performLogin } from '@frontend-e2e/helpers/login.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { performRegister } from '@frontend-e2e/helpers/register-page.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `email-verify-2fa-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Email verification with required 2FA', () => {
  test('registration verification continues to setup 2FA selection', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('register');
    await performRegister(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/email**');

    const token = await getEmailToken(String(baseURL), email);
    await page.locator('input[name="token"]').fill(token);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/setup/2fa**');
    await expect(page).toHaveURL(/\/setup\/2fa/);
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('login verification continues to setup 2FA selection', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('login');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/email**');

    const token = await getEmailToken(String(baseURL), email);
    await page.locator('input[name="token"]').fill(token);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/setup/2fa**');
    await expect(page).toHaveURL(/\/setup\/2fa/);
    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });
});
