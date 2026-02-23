import {
  expect,
  test,
} from '@frontend-e2e/fixtures/oauth-providers-specific.js';
import {
  expectOAuthError,
  startOAuthLogin,
} from '@frontend-e2e/helpers/oauth.js';
import { z } from 'zod';

const oauthErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

async function initOAuthSession(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
  providerId: string,
): Promise<{ callbackUrl: URL; state: string }> {
  const response = await request.get(
    `${baseURL}/api/oauth/${providerId}/authorize?mode=login`,
    {
      maxRedirects: 0,
    },
  );

  expect(response.status()).toBe(302);
  const location = response.headers()['location'];
  if (!location) {
    throw new Error('Expected redirect location from provider authorize');
  }

  const providerAuthorizeUrl = new URL(location);
  const callback = providerAuthorizeUrl.searchParams.get('redirect_uri');
  const state = providerAuthorizeUrl.searchParams.get('state');
  if (!callback || !state) {
    throw new Error('Expected redirect_uri and state from provider authorize');
  }

  return {
    callbackUrl: new URL(callback),
    state,
  };
}

async function expectOAuthCallbackError(
  request: import('@playwright/test').APIRequestContext,
  url: URL,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  const response = await request.get(url.toString(), {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(expectedStatus);

  const payload = oauthErrorResponseSchema.parse(await response.json());
  expect(payload.code).toBe(expectedCode);
}

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

    await expectOAuthCallbackError(
      request,
      callbackUrl,
      400,
      'OAUTH_INVALID_REQUEST',
    );
  });

  test('missing callback code returns OAUTH_INVALID_REQUEST', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(
      `${String(baseURL)}/api/oauth/missing-code-stub/callback`,
    );
    callbackUrl.searchParams.set('state', 'missing-code-state');

    await expectOAuthCallbackError(
      request,
      callbackUrl,
      400,
      'OAUTH_INVALID_REQUEST',
    );
  });

  test('state mismatch returns OAUTH_STATE_MISMATCH', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthSession(
      request,
      String(baseURL),
      'google-stub',
    );
    session.callbackUrl.searchParams.set('code', 'google-stub-code');
    session.callbackUrl.searchParams.set('state', `${session.state}-mismatch`);

    await expectOAuthCallbackError(
      request,
      session.callbackUrl,
      400,
      'OAUTH_STATE_MISMATCH',
    );
  });

  test('token exchange failure returns OAUTH_TOKEN_EXCHANGE_FAILED', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthSession(
      request,
      String(baseURL),
      'token-error-stub',
    );
    session.callbackUrl.searchParams.set(
      'code',
      'token-error-stub-token-error-code',
    );
    session.callbackUrl.searchParams.set('state', session.state);

    await expectOAuthCallbackError(
      request,
      session.callbackUrl,
      502,
      'OAUTH_TOKEN_EXCHANGE_FAILED',
    );
  });

  test('userinfo failure returns OAUTH_USERINFO_FAILED', async ({
    request,
    baseURL,
  }) => {
    const session = await initOAuthSession(
      request,
      String(baseURL),
      'userinfo-error-stub',
    );
    session.callbackUrl.searchParams.set(
      'code',
      'userinfo-error-stub-userinfo-error-code',
    );
    session.callbackUrl.searchParams.set('state', session.state);

    await expectOAuthCallbackError(
      request,
      session.callbackUrl,
      502,
      'OAUTH_USERINFO_FAILED',
    );
  });
});
