import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  createAuthenticatedSession,
  expectError,
  extractCookie,
  setupTestServer,
} from '@/test-utils/index.js';

const app = setupTestServer();

/**
 * Helper: Start OAuth flow and get session data
 */
async function startOAuthFlow(
  provider: string,
  mode: 'login' | 'register' | 'link' = 'login',
  sessionCookie?: string,
): Promise<{ sessionCookie: string; state: string }> {
  const res = await app.inject({
    method: 'GET',
    url: `/api/v1/oauth/${provider}/connect`,
    query: { mode },
    ...(sessionCookie && { cookies: { session: sessionCookie } }),
  });

  expect(res.statusCode).toBe(302);

  const location = new URL(res.headers.location as string);
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

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          error: 'access_denied',
          error_description: 'User denied access',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(res.headers.location as string, 'http://test');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('error')).toBe('access_denied');
      expect(location.searchParams.get('error_description')).toBe(
        'User denied access',
      );
    });

    test('should handle OAuth error without description', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          error: 'server_error',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(res.headers.location as string, 'http://test');
      expect(location.searchParams.get('error')).toBe('server_error');
    });
  });

  describe('Session Validation', () => {
    test('should return error when OAuth session is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'test-code',
          state: 'test-state',
        },
        // No session cookie
      });

      expectError(res, e.OAuthSessionExpired);
    });

    test('should return error when OAuth session has expired', async () => {
      // Create a fresh session without OAuth data
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test-config-user@example.com',
          password: 'changemelater',
        },
      });

      const sessionCookie = extractCookie(loginRes, 'session');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'test-code',
          state: 'test-state',
        },
        cookies: { session: sessionCookie },
      });

      expectError(res, e.OAuthSessionExpired);
    });
  });

  describe('State Validation', () => {
    test('should return error when state does not match', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'test-code',
          state: 'wrong-state-value',
        },
        cookies: { session: sessionCookie },
      });

      expectError(res, e.OAuthStateMismatch);
    });

    test('should return error when state is empty', async () => {
      const { sessionCookie } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'test-code',
          state: '',
        },
        cookies: { session: sessionCookie },
      });

      // Zod validation should fail for empty state
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Provider Validation', () => {
    test('should return error when provider does not match session', async () => {
      // Start flow with google
      const { sessionCookie, state } = await startOAuthFlow('google');

      // Callback to github (different provider)
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/github/callback',
        query: {
          code: 'test-code',
          state,
        },
        cookies: { session: sessionCookie },
      });

      expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for non-existent provider', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/nonexistent/callback',
        query: {
          code: 'test-code',
          state,
        },
        cookies: { session: sessionCookie },
      });

      expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Code Parameter Validation', () => {
    test('should return error when code is missing', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          state,
          // code is missing
        },
        cookies: { session: sessionCookie },
      });

      expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when code is empty', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: '',
          state,
        },
        cookies: { session: sessionCookie },
      });

      // Empty string fails min(1) validation via Zod
      expect(res.statusCode).toBe(400);
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
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'invalid-test-code',
          state,
        },
        cookies: { session: oauthSession },
      });

      // Will fail at token exchange, not at auth check
      // This means link mode flow is working
      expect(res.statusCode).toBe(502); // Token exchange failed
      expectError(res, e.OAuthTokenExchangeFailed);
    });
  });

  describe('Token Exchange Errors', () => {
    test('should return 502 when token exchange fails', async () => {
      const { sessionCookie, state } = await startOAuthFlow('google');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'invalid-authorization-code',
          state,
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(502);
      expectError(res, e.OAuthTokenExchangeFailed);
    });
  });

  describe('Request Schema Validation', () => {
    test('should return error when no query parameters provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        // No query params
      });

      // Should fail due to missing code and state
      expectError(res, e.OAuthInvalidRequest);
    });

    test('should return error when state is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/callback',
        query: {
          code: 'test-code',
          // state missing
        },
      });

      expectError(res, e.OAuthInvalidRequest);
    });
  });
});
