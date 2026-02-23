import { expect, test } from '@frontend-e2e/fixtures/oauth-providers-terms.js';
import { consentPage } from '@frontend-e2e/helpers/consent.js';
import { startOAuthLogin } from '@frontend-e2e/helpers/oauth.js';
import {
  buildAuthorizePath,
  buildOAuthFlowInput,
  captureClientRedirectAfterAction,
  exchangeAuthorizationCode,
  expectOAuthParamsInCurrentUrl,
} from '@frontend-e2e/helpers/oauth-client-flow.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';

test.describe('OAuth client continuity through complete-registration terms', () => {
  test('new OAuth signup returns to authorize flow and reaches client callback', async ({
    page,
    request,
    baseURL,
  }) => {
    const oauth = buildOAuthFlowInput(`oauth-providers-terms-${Date.now()}`);

    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });
    await page.waitForURL('**/login**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    await startOAuthLogin(page, 'Stub New User OIDC');
    await page.waitForURL('**/terms**');

    const termsUrl = new URL(page.url());
    expect(termsUrl.pathname).toBe('/terms');
    expect(termsUrl.searchParams.get('mode')).toBe('complete_registration');
    expect(termsUrl.searchParams.get('registration_token')).toBeTruthy();

    const redirect = termsUrl.searchParams.get('redirect');
    if (!redirect) {
      throw new Error('Expected redirect parameter on complete registration');
    }
    const redirectUrl = new URL(redirect);
    expect(redirectUrl.pathname).toBe('/oauth/authorize');
    expect(redirectUrl.searchParams.get('state')).toBe(
      oauth.authorizeParams.state,
    );

    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/consent**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    const callbackUrl = await captureClientRedirectAfterAction(page, async () =>
      page.locator(consentPage.allowButton).click(),
    );
    expect(callbackUrl.searchParams.get('state')).toBe(
      oauth.authorizeParams.state,
    );

    const code = callbackUrl.searchParams.get('code');
    if (!code) {
      throw new Error('Expected authorization code in callback URL');
    }

    const tokens = await exchangeAuthorizationCode(request, String(baseURL), {
      code,
      codeVerifier: oauth.codeVerifier,
    });
    expect(tokens.access_token).toBeTruthy();
  });

  test('invalid registration token keeps oauth redirect context for retry', async ({
    page,
  }) => {
    const oauth = buildOAuthFlowInput(
      `oauth-providers-terms-invalid-token-${Date.now()}`,
    );

    await page.goto(buildAuthorizePath(oauth.authorizeParams), {
      waitUntil: 'networkidle',
    });
    await page.waitForURL('**/login**');

    await startOAuthLogin(page, 'Stub New User OIDC');
    await page.waitForURL('**/terms**');

    const initialTermsUrl = new URL(page.url());
    const redirect = initialTermsUrl.searchParams.get('redirect');
    if (!redirect) {
      throw new Error('Expected redirect parameter on complete registration');
    }

    await page.goto(
      `/terms?mode=complete_registration&registration_token=invalid-token&redirect=${encodeURIComponent(redirect)}`,
    );

    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByText('Failed to submit consent. Please try again.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/terms/);

    const retryTermsUrl = new URL(page.url());
    expect(retryTermsUrl.searchParams.get('mode')).toBe(
      'complete_registration',
    );
    expect(retryTermsUrl.searchParams.get('redirect')).toBe(redirect);

    const redirectUrl = new URL(redirect);
    expect(redirectUrl.pathname).toBe('/oauth/authorize');
    expect(redirectUrl.searchParams.get('state')).toBe(
      oauth.authorizeParams.state,
    );
  });
});
