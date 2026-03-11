import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestAppConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { createSpecificOauthProviders } from '#frontend-e2e/fragments/oauth-providers.js';
import {
  expectOAuthError,
  startOAuthLogin,
} from '#frontend-e2e/helpers/oauth.js';
import {
  expectOAuthCallbackApiError,
  initOAuthCallbackSession,
} from '#frontend-e2e/helpers/oauth-callback.js';

const test = createScenarioFixture((backendPort) => {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    app: createTestAppConfig(backendPort, {
      allowed_signup_emails: ['*@allowed.test'],
    }),
    identity_providers: createSpecificOauthProviders(host),
  };
});

test.describe('OAuth callback error handling', () => {
  test('apple form_post denied callback maps to access denied message', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Apple Denied Stub');

    await expectOAuthError(page, 'The authorization request was denied.');
  });

  test('callback server_error maps to login server error message', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Server Error Stub');

    await expectOAuthError(
      page,
      'An error occurred on the authentication server. Please try again later.',
    );
  });

  test('callback temporarily_unavailable maps to temporary error message', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Temporarily Unavailable Stub');

    await expectOAuthError(
      page,
      'The service is temporarily unavailable. Please try again later.',
    );
  });

  test('unknown callback error falls back to generic oauth failure message', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Unknown Error Stub');

    await expectOAuthError(page, 'OAuth login failed. Please try again.');
  });

  test('missing callback state returns OAUTH_INVALID_REQUEST', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(
      `${String(baseURL)}/api/oauth/missing-state-stub/callback`,
    );
    callbackUrl.searchParams.set('code', 'missing-state-stub-code');

    await expectOAuthCallbackApiError(request, callbackUrl, {
      status: 400,
      code: 'OAUTH_INVALID_REQUEST',
    });
  });

  test('missing callback code returns OAUTH_INVALID_REQUEST', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(
      `${String(baseURL)}/api/oauth/missing-code-stub/callback`,
    );
    callbackUrl.searchParams.set('state', 'missing-code-state');

    await expectOAuthCallbackApiError(request, callbackUrl, {
      status: 400,
      code: 'OAUTH_INVALID_REQUEST',
    });
  });

  test('state mismatch returns OAUTH_STATE_MISMATCH', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthCallbackSession(
      request,
      String(baseURL),
      'google-stub',
    );
    session.callbackUrl.searchParams.set('code', 'google-stub-code');
    session.callbackUrl.searchParams.set('state', `${session.state}-mismatch`);

    await expectOAuthCallbackApiError(request, session.callbackUrl, {
      status: 400,
      code: 'OAUTH_STATE_MISMATCH',
    });
  });

  test('token exchange failure returns OAUTH_TOKEN_EXCHANGE_FAILED', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthCallbackSession(
      request,
      String(baseURL),
      'token-error-stub',
    );
    session.callbackUrl.searchParams.set(
      'code',
      'token-error-stub-token-error-code',
    );
    session.callbackUrl.searchParams.set('state', session.state);

    await expectOAuthCallbackApiError(request, session.callbackUrl, {
      status: 502,
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
    });
  });

  test('userinfo failure returns OAUTH_USERINFO_FAILED', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthCallbackSession(
      request,
      String(baseURL),
      'userinfo-error-stub',
    );
    session.callbackUrl.searchParams.set(
      'code',
      'userinfo-error-stub-userinfo-error-code',
    );
    session.callbackUrl.searchParams.set('state', session.state);

    await expectOAuthCallbackApiError(request, session.callbackUrl, {
      status: 502,
      code: 'OAUTH_USERINFO_FAILED',
    });
  });

  test('callback without oauth session returns OAUTH_SESSION_EXPIRED', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(
      `${String(baseURL)}/api/oauth/google-stub/callback`,
    );
    callbackUrl.searchParams.set('code', 'google-stub-code');
    callbackUrl.searchParams.set('state', 'missing-oauth-session');

    await expectOAuthCallbackApiError(request, callbackUrl, {
      status: 400,
      code: 'OAUTH_SESSION_EXPIRED',
    });
  });

  test('replayed callback returns OAUTH_SESSION_EXPIRED', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthCallbackSession(
      request,
      String(baseURL),
      'google-stub',
    );
    session.callbackUrl.searchParams.set('code', 'google-stub-code');
    session.callbackUrl.searchParams.set('state', session.state);

    const firstCallbackResponse = await request.get(
      session.callbackUrl.toString(),
      {
        maxRedirects: 0,
      },
    );
    expect(firstCallbackResponse.status()).toBe(302);

    await expectOAuthCallbackApiError(request, session.callbackUrl, {
      status: 400,
      code: 'OAUTH_SESSION_EXPIRED',
    });
  });
});
