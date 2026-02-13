import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  expectError,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';
import type { AppType } from '@/types.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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
          enabled: false,
          display_name: 'GitHub',
          client_id: 'test-github-client-id',
          client_secret: 'test-github-client-secret',
          email_conflict_strategy: 'auto_link',
        },
      ],
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

/**
 * Helper: Start OAuth flow and get session data
 */
async function startOAuthFlow(
  provider: string,
  mode: 'login' | 'register' | 'link' = 'login',
  sessionCookie?: string,
): Promise<{ sessionCookie: string; state: string }> {
  const url =
    `/api/v1/oauth/${provider}/authorize?` +
    new URLSearchParams({ mode }).toString();

  const res = await app.request(url, {
    method: 'GET',
    ...(sessionCookie && {
      headers: { Cookie: `session=${sessionCookie}` },
    }),
  });

  expect(res.status).toBe(302);

  const location = new URL(res.headers.get('location') as string);
  const state = location.searchParams.get('state');
  expect(state).toBeDefined();

  const cookie = extractCookie(res, 'session');

  return { sessionCookie: cookie, state: state as string };
}

describe('GET /api/v1/oauth/:provider/callback', () => {
  describe('Error Handling - OAuth Provider Errors', () => {
    test('should redirect to login with error when OAuth provider returns error', async () => {
      // Start OAuth flow to get valid session
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            error: 'access_denied',
            error_description: 'User denied access',
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      expect(res.status).toBe(302);
      const location = new URL(
        res.headers.get('location') as string,
        'http://test',
      );
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('oauth_error')).toBe('access_denied');
      expect(location.searchParams.get('oauth_error_description')).toBe(
        'User denied access',
      );
    });

    test('should handle OAuth error without description', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            error: 'server_error',
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      expect(res.status).toBe(302);
      const location = new URL(
        res.headers.get('location') as string,
        'http://test',
      );
      expect(location.searchParams.get('oauth_error')).toBe('server_error');
    });
  });

  describe('Session Validation', () => {
    test('should return error when OAuth session is missing', async () => {
      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state: 'test-state',
          }).toString(),
        {
          method: 'GET',
          // No session cookie
        },
      );

      await expectError(res, e.OAuthSessionExpired);
    });

    test('should return error when OAuth session has expired', async () => {
      // Create a fresh session without OAuth data
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test-config-user@example.com',
          password: 'changemelater',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const sessionCookie = extractCookie(loginRes, 'session');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state: 'test-state',
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      await expectError(res, e.OAuthSessionExpired);
    });
  });

  describe('State Validation', () => {
    test('should return error when state does not match', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state: 'wrong-state-value',
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      await expectError(res, e.OAuthStateMismatch);
    });

    test('should return error when state is empty', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state: '',
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
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
      const res = await app.request(
        '/api/v1/oauth/github/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state,
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for non-existent provider', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/nonexistent/callback?' +
          new URLSearchParams({
            code: 'test-code',
            state,
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      await expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Code Parameter Validation', () => {
    test('should return error when code is missing', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            state,
            // code is missing
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      await expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when code is empty', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: '',
            state,
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
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
        'link',
        sessionCookie,
      );

      // Note: Token exchange will fail with test code, but we verify the flow starts correctly
      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'invalid-test-code',
            state,
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${oauthSession}` },
        },
      );

      // Will fail at token exchange, not at auth check
      // This means link mode flow is working
      expect(res.status).toBe(502); // Token exchange failed
      await expectError(res, e.OAuthTokenExchangeFailed);
    });
  });

  describe('Token Exchange Errors', () => {
    test('should return 502 when token exchange fails', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'invalid-authorization-code',
            state,
          }).toString(),
        {
          method: 'GET',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      expect(res.status).toBe(502);
      await expectError(res, e.OAuthTokenExchangeFailed);
    });
  });

  describe('Request Schema Validation', () => {
    test('should return error when no query parameters provided', async () => {
      const res = await app.request('/api/v1/oauth/google/callback', {
        method: 'GET',
        // No query params
      });

      // Should fail due to missing code and state
      await expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when state is missing', async () => {
      const res = await app.request(
        '/api/v1/oauth/google/callback?' +
          new URLSearchParams({
            code: 'test-code',
            // state missing
          }).toString(),
        {
          method: 'GET',
        },
      );

      await expectError(res, e.OAuthInvalidRequest);
    });
  });
});
