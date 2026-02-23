import { E2E_TEST_CLIENT } from '@frontend-e2e/fixtures/index.js';
import { expect, test } from '@frontend-e2e/fixtures/journey-oauth-2fa.js';
import {
  allowConsentAndExpectRedirect,
  buildAuthEntryUrl,
  buildJourneyOAuthParams,
  completeEmailVerification,
  completeTotpSetup,
  completeTotpVerify,
  expectOAuthParamsPresent,
  type JourneyOAuthParams,
} from '@frontend-e2e/helpers/journey.js';
import {
  emailVerifyPage,
  loginPasswordPage,
} from '@frontend-e2e/helpers/login.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';
import { interceptTotpSecret } from '@frontend-e2e/helpers/totp.js';
import { enableVirtualAuthenticator } from '@frontend-e2e/helpers/webauthn.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `journey-oauth-2fa-${suffix}-${ts}@example.com`;
}

function uniqueOauthParams(suffix: string): JourneyOAuthParams {
  const ts = Date.now();
  return buildJourneyOAuthParams(`journey-${suffix}-${ts}`);
}

async function submitRegisterForm(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.locator(registerPage.emailInput).fill(email);
  await page.locator(registerPage.passwordInput).fill(password);
  await page.locator(registerPage.submitButton).click();
}

async function submitPasswordLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();
}

const TEST_PASSWORD = 'test-password-123';

test.describe('OAuth continuation across email verification and 2FA', () => {
  test('register -> verify email -> setup TOTP -> consent redirect', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('register-totp');
    const oauthParams = uniqueOauthParams('register-totp');

    await page.goto(buildAuthEntryUrl('register', 'form', oauthParams));
    await submitRegisterForm(page, email, TEST_PASSWORD);

    await page.waitForURL('**/verify/email**');
    await expectOAuthParamsPresent(page, oauthParams);

    await completeEmailVerification(page, String(baseURL), email);
    await page.waitForURL('**/setup/2fa**');
    await expectOAuthParamsPresent(page, oauthParams);

    const totpSecretPromise = interceptTotpSecret(page);
    await page.locator('a[href^="/setup/totp"]').click();
    await page.waitForURL('**/setup/totp**');
    await expectOAuthParamsPresent(page, oauthParams);

    const totpSecret = await totpSecretPromise;
    await completeTotpSetup(page, totpSecret);

    await page.waitForURL('**/consent**');
    await expectOAuthParamsPresent(page, oauthParams);

    await allowConsentAndExpectRedirect(
      page,
      E2E_TEST_CLIENT.redirectUri,
      oauthParams.state,
    );
  });

  test('register -> verify email -> setup passkey -> consent redirect', async ({
    page,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('register-passkey');
      const oauthParams = uniqueOauthParams('register-passkey');

      await page.goto(buildAuthEntryUrl('register', 'form', oauthParams));
      await submitRegisterForm(page, email, TEST_PASSWORD);

      await page.waitForURL('**/verify/email**');
      await expectOAuthParamsPresent(page, oauthParams);

      await completeEmailVerification(page, String(baseURL), email);
      await page.waitForURL('**/setup/2fa**');
      await expectOAuthParamsPresent(page, oauthParams);

      await page.locator('a[href^="/setup/passkey"]').click();
      await page.waitForURL('**/setup/passkey**');

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

  test('login -> verify email -> setup 2FA -> consent redirect', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('login-verify-setup');
    const oauthParams = uniqueOauthParams('login-verify-setup');

    await registerUser(request, String(baseURL), email, TEST_PASSWORD);

    await page.goto(buildAuthEntryUrl('login', 'password', oauthParams));
    await submitPasswordLogin(page, email, TEST_PASSWORD);

    await page.waitForURL('**/verify/email**');
    await expectOAuthParamsPresent(page, oauthParams);

    await completeEmailVerification(page, String(baseURL), email);
    await page.waitForURL('**/setup/2fa**');
    await expectOAuthParamsPresent(page, oauthParams);

    const totpSecretPromise = interceptTotpSecret(page);
    await page.locator('a[href^="/setup/totp"]').click();
    await page.waitForURL('**/setup/totp**');
    await expectOAuthParamsPresent(page, oauthParams);

    const totpSecret = await totpSecretPromise;
    await completeTotpSetup(page, totpSecret);

    await page.waitForURL('**/consent**');
    await expectOAuthParamsPresent(page, oauthParams);

    await allowConsentAndExpectRedirect(
      page,
      E2E_TEST_CLIENT.redirectUri,
      oauthParams.state,
    );
  });

  test('login with both factors -> verify/2fa -> totp -> consent redirect', async ({
    page,
    baseURL,
    browserName,
  }) => {
    test.setTimeout(120_000);
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    let hasVirtualAuth = true;
    try {
      const email = uniqueEmail('login-verify-2fa');
      const oauthParams = uniqueOauthParams('login-verify-2fa');

      await page.goto('/register');
      await submitRegisterForm(page, email, TEST_PASSWORD);
      await page.waitForURL('**/verify/email**');

      await completeEmailVerification(page, String(baseURL), email);
      await page.waitForURL('**/setup/2fa**');

      const totpSecretPromise = interceptTotpSecret(page);
      await page.locator('a[href^="/setup/totp"]').click();
      await page.waitForURL('**/setup/totp**');
      const totpSecret = await totpSecretPromise;
      await completeTotpSetup(page, totpSecret);
      await page.waitForURL('**/profile');

      await page.goto('/setup/passkey?passkey_name=default');
      await page.waitForURL('**/profile');

      // Prevent conditional passkey autofill from short-circuiting
      // password login in this test path.
      await virtualAuth.teardown();
      hasVirtualAuth = false;

      await page.getByRole('button', { name: 'Log out' }).click();
      await page.waitForURL('**/login');

      await page.goto(buildAuthEntryUrl('login', 'password', oauthParams));
      await submitPasswordLogin(page, email, TEST_PASSWORD);

      await page.waitForURL('**/verify/2fa**');
      await expectOAuthParamsPresent(page, oauthParams);
      await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
      await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();

      await page.locator('a[href^="/verify/totp"]').click();
      await page.waitForURL('**/verify/totp**');
      await expectOAuthParamsPresent(page, oauthParams);

      await completeTotpVerify(page, totpSecret);
      await page.waitForURL('**/consent**');
      await expectOAuthParamsPresent(page, oauthParams);

      await allowConsentAndExpectRedirect(
        page,
        E2E_TEST_CLIENT.redirectUri,
        oauthParams.state,
      );
    } finally {
      if (hasVirtualAuth) {
        await virtualAuth.teardown();
      }
    }
  });

  test('non-oauth register journey falls back to profile', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('non-oauth');

    await page.goto('/register');
    await submitRegisterForm(page, email, TEST_PASSWORD);

    await page.waitForURL('**/verify/email**');
    await completeEmailVerification(page, String(baseURL), email);
    await page.waitForURL('**/setup/2fa**');

    const totpSecretPromise = interceptTotpSecret(page);
    await page.locator('a[href^="/setup/totp"]').click();
    await page.waitForURL('**/setup/totp**');
    const totpSecret = await totpSecretPromise;
    await completeTotpSetup(page, totpSecret);

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('invalid verify-email token keeps oauth params for retry', async ({
    page,
  }) => {
    const email = uniqueEmail('invalid-token');
    const oauthParams = uniqueOauthParams('invalid-token');

    await page.goto(buildAuthEntryUrl('register', 'form', oauthParams));
    await submitRegisterForm(page, email, TEST_PASSWORD);

    await page.waitForURL('**/verify/email**');
    await expectOAuthParamsPresent(page, oauthParams);

    await page.locator(emailVerifyPage.tokenInput).fill('invalid-token-value');
    await page.locator(emailVerifyPage.submitButton).click();

    await expect(
      page.locator(emailVerifyPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/verify\/email/);
    await expectOAuthParamsPresent(page, oauthParams);
  });
});
