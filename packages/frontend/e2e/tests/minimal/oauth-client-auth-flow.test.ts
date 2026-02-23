import { expect, test } from '@frontend-e2e/fixtures/minimal.js';
import { consentPage } from '@frontend-e2e/helpers/consent.js';
import {
  loginMethodPage,
  loginPasswordPage,
} from '@frontend-e2e/helpers/login.js';
import {
  allowConsentAndCaptureCode,
  buildAuthorizePath,
  buildOAuthFlowInput,
  captureClientRedirectAfterAction,
  denyConsentAndCaptureRedirect,
  exchangeAuthorizationCode,
  expectOAuthParamsInCurrentUrl,
} from '@frontend-e2e/helpers/oauth-client-flow.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

const TEST_PASSWORD = 'test-password-123';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `oauth-client-${suffix}-${ts}@example.com`;
}

async function registerUserByApi(
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: { email, password },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

async function loginThroughPasswordForm(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.locator(loginMethodPage.passwordMethodLink).click();
  await page.waitForURL('**/login/password**');
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();
}

test.describe('OAuth client authentication flow', () => {
  test('unauthenticated authorize request redirects to login with OAuth params', async ({
    page,
  }) => {
    const oauth = buildOAuthFlowInput('oauth-unauthenticated');

    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });

    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);
  });

  test('existing user logs in and exchanges authorization code for tokens', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('login');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);

    const oauth = buildOAuthFlowInput('oauth-login');
    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });

    await page.waitForURL('**/login**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    await loginThroughPasswordForm(page, email, TEST_PASSWORD);

    await page.waitForURL('**/consent**');
    await expect(page.locator(consentPage.userEmail)).toContainText(email);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    const code = await allowConsentAndCaptureCode(page);
    const tokens = await exchangeAuthorizationCode(request, String(baseURL), {
      code,
      codeVerifier: oauth.codeVerifier,
    });

    expect(tokens.id_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
  });

  test('new signup during OAuth flow without explicit terms exchanges tokens', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('signup');
    const oauth = buildOAuthFlowInput('oauth-signup');

    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });

    await page.waitForURL('**/login**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    await page.goto(
      `/register?${new URLSearchParams(oauth.authorizeParams).toString()}`,
    );
    await page.waitForURL('**/register**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(registerPage.submitButton).click();

    await page.waitForURL('**/consent**');
    await expect(page.locator(consentPage.userEmail)).toContainText(email);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    const code = await allowConsentAndCaptureCode(page);
    const tokens = await exchangeAuthorizationCode(request, String(baseURL), {
      code,
      codeVerifier: oauth.codeVerifier,
    });

    expect(tokens.id_token).toBeTruthy();
  });

  test('already consented user logs in and skips consent page', async ({
    browser,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('already-consented');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);

    const firstContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const initialFlow = buildOAuthFlowInput('oauth-first-consent');

    await firstPage.goto(
      `${String(baseURL)}${buildAuthorizePath(initialFlow.authorizeParams)}`,
      { waitUntil: 'networkidle' },
    );
    await firstPage.waitForURL('**/login**');
    await loginThroughPasswordForm(firstPage, email, TEST_PASSWORD);
    await firstPage.waitForURL('**/consent**');

    const firstCode = await allowConsentAndCaptureCode(firstPage);
    await exchangeAuthorizationCode(request, String(baseURL), {
      code: firstCode,
      codeVerifier: initialFlow.codeVerifier,
    });
    await firstContext.close();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    const secondFlow = buildOAuthFlowInput('oauth-skip-consent', {
      prompt: undefined,
    });

    await secondPage.goto(
      `${String(baseURL)}${buildAuthorizePath(secondFlow.authorizeParams)}`,
      { waitUntil: 'networkidle' },
    );
    await secondPage.waitForURL('**/login**');

    await secondPage.locator(loginMethodPage.passwordMethodLink).click();
    await secondPage.waitForURL('**/login/password**');
    await secondPage.locator(loginPasswordPage.emailInput).fill(email);
    await secondPage
      .locator(loginPasswordPage.passwordInput)
      .fill(TEST_PASSWORD);

    const redirectUrl = await captureClientRedirectAfterAction(secondPage, () =>
      secondPage.locator(loginPasswordPage.submitButton).click(),
    );

    expect(redirectUrl.searchParams.get('code')).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBe(
      secondFlow.authorizeParams.state,
    );

    const consentReached = await secondPage
      .waitForURL('**/consent**', { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    expect(consentReached).toBe(false);

    const secondCode = redirectUrl.searchParams.get('code');
    if (!secondCode) {
      throw new Error('Expected code in already-consented redirect');
    }

    await exchangeAuthorizationCode(request, String(baseURL), {
      code: secondCode,
      codeVerifier: secondFlow.codeVerifier,
    });

    await secondContext.close();
  });

  test('denying consent redirects with access_denied error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('deny');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);

    const oauth = buildOAuthFlowInput('oauth-deny');
    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });

    await page.waitForURL('**/login**');
    await loginThroughPasswordForm(page, email, TEST_PASSWORD);

    await page.waitForURL('**/consent**');
    const url = await denyConsentAndCaptureRedirect(page);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe(oauth.authorizeParams.state);
  });

  test('token exchange rejects invalid PKCE verifier', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = uniqueEmail('invalid-pkce');
    await registerUserByApi(String(baseURL), email, TEST_PASSWORD);

    const oauth = buildOAuthFlowInput('oauth-invalid-pkce');
    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });

    await page.waitForURL('**/login**');
    await loginThroughPasswordForm(page, email, TEST_PASSWORD);
    await page.waitForURL('**/consent**');

    const code = await allowConsentAndCaptureCode(page);

    const response = await request.post(`${String(baseURL)}/oauth/token`, {
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: oauth.authorizeParams.redirect_uri,
        client_id: oauth.authorizeParams.client_id,
        code_verifier: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PKCE_VERIFIER',
    });
  });
});
