import { expect } from '@playwright/test';
import { genericOAuth } from '@tinyrack/issuary-server/identity-providers/generic-oauth';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';
import { uniqueTestId } from '#frontend-e2e/helpers/identity.ts';
import { startOAuthLogin } from '#frontend-e2e/helpers/oauth.ts';
import {
  buildAuthorizePath,
  buildOAuthFlowInput,
  captureClientRedirectAfterAction,
  exchangeAuthorizationCode,
  expectOAuthParamsInCurrentUrl,
} from '#frontend-e2e/helpers/oauth-client-flow.ts';
import { registerPage } from '#frontend-e2e/helpers/register-page.ts';

const TERMS_CONFIG = [
  {
    id: 'tos',
    required: true,
    consent_mode: 'explicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Terms of Service',
        type: 'text',
        content: 'Test Terms of Service content for oauth providers terms.',
      },
    },
  },
  {
    id: 'privacy',
    required: false,
    consent_mode: 'explicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Privacy Policy',
        type: 'text',
        content: 'Test Privacy Policy content for oauth providers terms.',
      },
    },
  },
  {
    id: 'analytics',
    required: true,
    consent_mode: 'implicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Analytics Terms',
        type: 'text',
        content: 'Implicit analytics terms for oauth providers terms.',
      },
    },
  },
] as const;

const test = createScenarioFixture((backendPort) => {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    ...createTestConfig(backendPort, {
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
    }),
    identity_providers: [
      genericOAuth({
        id: 'stub-new-user-oidc',
        enabled: true,
        display_name: 'Stub New User OIDC',
        icon_url: 'https://example.com/stub-new-user-oidc.svg',
        client_id: 'stub-new-user-oidc-client-id',
        client_secret: 'stub-new-user-oidc-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-new-user-oidc/authorize`,
        token_url: `${host}/test/oauth-stub/stub-new-user-oidc/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-new-user-oidc/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      }),
    ],
    terms: [...TERMS_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
});

test.describe('OAuth client continuity through complete-registration terms', () => {
  test('new OAuth signup returns to authorize flow and reaches client callback', async ({
    page,
    request,
    baseURL,
  }) => {
    const oauth = buildOAuthFlowInput(
      uniqueTestId(test.info(), 'oauth-providers-terms'),
    );

    await page.goto(buildAuthorizePath(oauth.authorizeParams));
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
    const redirectUrl = new URL(redirect, page.url());
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
      uniqueTestId(test.info(), 'oauth-providers-terms-invalid-token'),
    );

    await page.goto(buildAuthorizePath(oauth.authorizeParams));
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

    const redirectUrl = new URL(redirect, page.url());
    expect(redirectUrl.pathname).toBe('/oauth/authorize');
    expect(redirectUrl.searchParams.get('state')).toBe(
      oauth.authorizeParams.state,
    );
  });
});
