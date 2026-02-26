import { testClient } from 'hono/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { AppType } from '#backend/app.js';
import { createApp } from '#backend/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  expectError,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  TEST_USER_CONFIG,
} from '#backend/test-utils/index.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      identity_providers: [
        {
          id: 'google',
          type: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        },
        {
          id: 'github',
          type: 'github',
          enabled: true,
          display_name: 'GitHub',
          client_id: 'test-github-client-id',
          client_secret: 'test-github-client-secret',
          email_conflict_strategy: 'auto_link',
        },
      ],
      terms: [],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await cleanup();
});

/**
 * Helper: Start OAuth flow and get session state/cookie.
 */
async function startOAuthFlow(
  provider: string,
  options?: {
    mode?: 'login' | 'register' | 'link';
    sessionCookie?: string;
    returnUrl?: string;
  },
): Promise<{ sessionCookie: string; state: string }> {
  const client = testClient(app);

  const res = await client.api.oauth[':provider'].authorize.$get(
    {
      param: { provider },
      query: {
        mode: options?.mode ?? 'login',
        ...(options?.returnUrl ? { return_url: options.returnUrl } : {}),
      },
    },
    options?.sessionCookie
      ? { headers: { Cookie: `session=${options.sessionCookie}` } }
      : undefined,
  );

  expect(res.status).toBe(302);

  const location = new URL(getLocationHeader(res));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Expected state parameter in OAuth redirect');
  }

  const cookie = extractCookie(res, 'session');
  return { sessionCookie: cookie, state };
}

describe('GET /api/oauth/:provider/callback', () => {
  describe('Success Flows', () => {
    test('should complete login mode callback and create authenticated session', async () => {
      const oauthEmail = generateUniqueEmail('oauth-callback-login');
      const { sessionCookie, state } = await startOAuthFlow('google', {
        mode: 'login',
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: GOOGLE_TOKEN_URL,
        userInfoUrl: GOOGLE_USERINFO_URL,
        userInfo: {
          id: `google-login-${Date.now()}`,
          email: oauthEmail,
          email_verified: true,
          name: 'OAuth Login User',
        },
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$get(
          {
            param: { provider: 'google' },
            query: {
              code: 'oauth-login-code',
              state,
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        const callbackLocation = new URL(
          getLocationHeader(callbackRes),
          'http://test',
        );
        expect(callbackLocation.pathname).toBe('/profile');

        const callbackCookie = extractCookie(callbackRes, 'session');

        const sessionClient = testClient(app);
        const sessionRes = await sessionClient.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const sessionBody = await assertJsonBody(sessionRes);
        expect(sessionBody.user).not.toBeNull();
        expect(sessionBody.user?.email).toBe(oauthEmail);

        const replayRes = await client.api.oauth[':provider'].callback.$get(
          {
            param: { provider: 'google' },
            query: {
              code: 'oauth-login-code',
              state,
            },
          },
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        await expectError(replayRes, e.OAuthSessionExpired);
      } finally {
        oauthMock.restore();
      }
    });

    test('should complete register mode callback and redirect to return_url', async () => {
      const oauthEmail = generateUniqueEmail('oauth-callback-register');
      const returnUrl = '/profile?tab=oauth';

      const { sessionCookie, state } = await startOAuthFlow('google', {
        mode: 'register',
        returnUrl,
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: GOOGLE_TOKEN_URL,
        userInfoUrl: GOOGLE_USERINFO_URL,
        userInfo: {
          id: `google-register-${Date.now()}`,
          email: oauthEmail,
          email_verified: true,
          name: 'OAuth Register User',
        },
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$get(
          {
            param: { provider: 'google' },
            query: {
              code: 'oauth-register-code',
              state,
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        const callbackLocation = new URL(
          getLocationHeader(callbackRes),
          'http://test',
        );
        expect(callbackLocation.pathname).toBe('/profile');
        expect(callbackLocation.searchParams.get('tab')).toBe('oauth');

        const callbackCookie = extractCookie(callbackRes, 'session');
        const sessionClient = testClient(app);
        const sessionRes = await sessionClient.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const sessionBody = await assertJsonBody(sessionRes);
        expect(sessionBody.user).not.toBeNull();
        expect(sessionBody.user?.email).toBe(oauthEmail);
      } finally {
        oauthMock.restore();
      }
    });

    test('should complete link mode callback and keep existing user session', async () => {
      const existingSessionCookie = await createAuthenticatedSession(app);
      const returnUrl = '/profile?tab=linked';

      const sessionClient = testClient(app);
      const beforeSessionRes = await sessionClient.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${existingSessionCookie}` } },
      );
      const beforeSession = await assertJsonBody(beforeSessionRes);
      const beforeUserSub = beforeSession.user?.sub;
      if (!beforeUserSub) {
        throw new Error('Expected authenticated user before OAuth link flow');
      }

      const { sessionCookie, state } = await startOAuthFlow('google', {
        mode: 'link',
        sessionCookie: existingSessionCookie,
        returnUrl,
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: GOOGLE_TOKEN_URL,
        userInfoUrl: GOOGLE_USERINFO_URL,
        userInfo: {
          id: `google-link-${Date.now()}`,
          email: generateUniqueEmail('oauth-callback-link'),
          email_verified: true,
          name: 'OAuth Link User',
        },
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$get(
          {
            param: { provider: 'google' },
            query: {
              code: 'oauth-link-code',
              state,
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        const callbackLocation = new URL(
          getLocationHeader(callbackRes),
          'http://test',
        );
        expect(callbackLocation.pathname).toBe('/profile');
        expect(callbackLocation.searchParams.get('tab')).toBe('linked');

        const callbackCookie = extractCookie(callbackRes, 'session');

        const afterSessionRes = await sessionClient.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const afterSession = await assertJsonBody(afterSessionRes);
        expect(afterSession.user?.sub).toBe(beforeUserSub);

        const linkedRes = await sessionClient.api.user['oauth-accounts'].$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const linkedBody = await assertJsonBody(linkedRes);
        const hasGoogleLink = linkedBody.accounts.some(
          (account: { provider_name: string }) =>
            account.provider_name === 'google',
        );
        expect(hasGoogleLink).toBe(true);
      } finally {
        oauthMock.restore();
      }
    });
  });

  describe('Error Handling - OAuth Provider Errors', () => {
    test('should redirect to login with error when OAuth provider returns error', async () => {
      // Start OAuth flow to get valid session
      const { sessionCookie } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            error: 'access_denied',
            error_description: 'User denied access',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://test');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('oauth_error')).toBe('access_denied');
      expect(location.searchParams.get('oauth_error_description')).toBe(
        'User denied access',
      );
    });

    test('should handle OAuth error without description', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            error: 'server_error',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://test');
      expect(location.searchParams.get('oauth_error')).toBe('server_error');
    });
  });

  describe('Session Validation', () => {
    test('should return error when OAuth session is missing', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get({
        param: { provider: 'google' },
        query: {
          code: 'test-code',
          state: 'test-state',
        },
      });

      await expectError(res, e.OAuthSessionExpired);
    });

    test('should return error when OAuth session has expired', async () => {
      // Create a fresh session without OAuth data
      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: {
          email: 'test-config-user@example.com',
          password: 'changemelater',
        },
      });

      const sessionCookie = extractCookie(loginRes, 'session');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'test-code',
            state: 'test-state',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthSessionExpired);
    });
  });

  describe('State Validation', () => {
    test('should return error when state does not match', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'test-code',
            state: 'wrong-state-value',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthStateMismatch);
    });

    test('should return error when state is empty', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'test-code',
            state: '',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Zod validation should fail for empty state
      expect(res.status).toBe(400);
    });
  });

  describe('Provider Validation', () => {
    test('should return error when provider does not match session', async () => {
      // Start flow with google
      const { sessionCookie, state } = await startOAuthFlow('google');

      // Callback to github (different provider)
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'github' },
          query: {
            code: 'test-code',
            state,
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for non-existent provider', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'nonexistent' },
          query: {
            code: 'test-code',
            state,
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Code Parameter Validation', () => {
    test('should return error when code is missing', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            state,
            // code is missing
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when code is empty', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: '',
            state,
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Empty string fails min(1) validation via Zod
      expect(res.status).toBe(400);
    });
  });

  describe('Link Mode', () => {
    test('should require authenticated session in link mode', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { sessionCookie: oauthSession, state } = await startOAuthFlow(
        'google',
        {
          mode: 'link',
          sessionCookie,
        },
      );

      const exchangeSpy = vi
        .spyOn(services.oauthConnectService, 'exchangeCodeForTokens')
        .mockRejectedValueOnce(new e.OAuthTokenExchangeFailed.Error());

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'invalid-test-code',
            state,
          },
        },
        { headers: { Cookie: `session=${oauthSession}` } },
      );

      expect(res.status).toBe(502);
      await expectError(res, e.OAuthTokenExchangeFailed);
      exchangeSpy.mockRestore();
    });
  });

  describe('Token Exchange Errors', () => {
    test('should return 502 when token exchange fails', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const exchangeSpy = vi
        .spyOn(services.oauthConnectService, 'exchangeCodeForTokens')
        .mockRejectedValueOnce(new e.OAuthTokenExchangeFailed.Error());

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get(
        {
          param: { provider: 'google' },
          query: {
            code: 'invalid-authorization-code',
            state,
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(502);
      await expectError(res, e.OAuthTokenExchangeFailed);
      exchangeSpy.mockRestore();
    });
  });

  describe('Request Schema Validation', () => {
    test('should return error when no query parameters provided', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get({
        param: { provider: 'google' },
        query: {},
      });

      // Should fail due to missing code and state
      await expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when state is missing', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$get({
        param: { provider: 'google' },
        query: {
          code: 'test-code',
          // state missing
        },
      });

      await expectError(res, e.OAuthInvalidRequest);
    });
  });

  describe('GitHub Callback', () => {
    test('should complete GitHub login with GitHub-specific field mapping', async () => {
      const oauthEmail = generateUniqueEmail('github-callback');
      const { sessionCookie, state } = await startOAuthFlow('github', {
        mode: 'login',
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: GITHUB_TOKEN_URL,
        userInfoUrl: GITHUB_USERINFO_URL,
        rawUserInfoResponse: {
          id: 42,
          email: oauthEmail,
          name: 'GitHub User',
          avatar_url: 'https://github.com/images/avatar.png',
        },
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$get(
          {
            param: { provider: 'github' },
            query: {
              code: 'github-auth-code',
              state,
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        const callbackLocation = new URL(
          getLocationHeader(callbackRes),
          'http://test',
        );
        expect(callbackLocation.pathname).toBe('/profile');

        // Verify session was created with correct user
        const callbackCookie = extractCookie(callbackRes, 'session');
        const sessionClient = testClient(app);
        const sessionRes = await sessionClient.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const sessionBody = await assertJsonBody(sessionRes);
        expect(sessionBody.user).not.toBeNull();
        expect(sessionBody.user?.email).toBe(oauthEmail);
      } finally {
        oauthMock.restore();
      }
    });
  });
});
