import { performLogin } from '@frontend-e2e/helpers/login.js';
import { recoveryPage } from '@frontend-e2e/helpers/recovery.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { generateTotpCode } from '@frontend-e2e/helpers/totp.js';
import { expect, test } from '@playwright/test';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `totp-recovery-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

/**
 * Sets up TOTP via API and returns both the secret and recovery codes.
 */
async function setupTotpWithRecoveryCodes(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
): Promise<{ secret: string; recoveryCodes: string[] }> {
  // Step 1: Start setup
  const setupRes = await request.post(`${baseURL}/api/user/totp/setup`);
  if (!setupRes.ok()) {
    throw new Error(
      `TOTP setup failed: ${setupRes.status()} ${await setupRes.text()}`,
    );
  }
  const { secret } = (await setupRes.json()) as { secret: string };

  // Step 2: Verify with valid code (returns recovery codes)
  const code = generateTotpCode(secret);
  const verifyRes = await request.post(`${baseURL}/api/user/totp/verify`, {
    data: { code },
  });
  if (!verifyRes.ok()) {
    throw new Error(
      `TOTP verify failed: ${verifyRes.status()} ${await verifyRes.text()}`,
    );
  }
  const verifyBody = (await verifyRes.json()) as {
    recovery_codes: string[];
  };

  // Step 3: Confirm
  const confirmRes = await request.post(`${baseURL}/api/user/totp/confirm`);
  if (!confirmRes.ok()) {
    throw new Error(
      `TOTP confirm failed: ${confirmRes.status()} ${await confirmRes.text()}`,
    );
  }

  return { secret, recoveryCodes: verifyBody.recovery_codes };
}

test.describe('TOTP recovery code verification', () => {
  let email: string;
  let recoveryCodes: string[];

  test.beforeAll(async ({ request, baseURL }) => {
    email = uniqueEmail('recovery');

    // Register user
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    // Set up TOTP and capture recovery codes
    const result = await setupTotpWithRecoveryCodes(request, String(baseURL));
    recoveryCodes = result.recoveryCodes;
  });

  test('valid recovery code succeeds and navigates to profile', async ({
    page,
  }) => {
    // Login
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    // Click "Use a recovery code" link
    await page.locator('button.link.link-info').click();
    await page.waitForURL('**/verify/totp/recovery');

    // Enter first recovery code
    const code = recoveryCodes[0];
    expect(code).toBeTruthy();
    await page.locator(recoveryPage.codeInput).fill(String(code));
    await page.locator(recoveryPage.submitButton).click();

    // Should navigate to profile
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('invalid recovery code shows error', async ({ page }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    await page.locator('button.link.link-info').click();
    await page.waitForURL('**/verify/totp/recovery');

    // Enter invalid recovery code
    await page.locator(recoveryPage.codeInput).fill('aaaa-bbbb');
    await page.locator(recoveryPage.submitButton).click();

    // Should show error
    await expect(page.locator(recoveryPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/verify\/totp\/recovery/);
  });

  test('"back to authenticator" link navigates to /verify/totp', async ({
    page,
  }) => {
    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/verify/totp');

    await page.locator('button.link.link-info').click();
    await page.waitForURL('**/verify/totp/recovery');

    // Click "back to authenticator" link
    await page.locator(recoveryPage.backToTotpLink).click();

    await page.waitForURL('**/verify/totp');
    await expect(page).toHaveURL(/\/verify\/totp$/);
  });
});
