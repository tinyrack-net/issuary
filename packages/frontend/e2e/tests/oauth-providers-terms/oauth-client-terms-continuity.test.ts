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
});
