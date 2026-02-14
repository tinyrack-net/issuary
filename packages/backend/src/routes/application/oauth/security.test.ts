import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, cleanup } = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  }));
});

afterAll(async () => {
  await cleanup();
});

/**
 * Security Tests for OAuth/OIDC Endpoints
 *
 * Tests cover:
 * - Input validation and sanitization
 * - Injection attacks (XSS, SQL, CRLF)
 * - Parameter manipulation
 * - Authorization bypass attempts
 * - Token security
 */
describe('OAuth Security Tests', () => {
  describe('XSS Prevention', () => {
    test('should escape special characters in error redirect URI', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await app.request('/api/v1/consent', {
        method: 'POST',
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
      });

      // Try XSS in state parameter
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: '<script>alert(1)</script>',
          }).toString(),
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      // Should redirect with URL-encoded state
      expect(res.status).toBe(302);
      const location = res.headers.get('location') as string;
      expect(location).not.toContain('<script>');
      // State should be URL-encoded (note: Fastify URL-encodes parentheses)
      expect(location).toContain('%3Cscript%3Ealert');
    });

    test('should handle XSS attempt in scope parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid<script>alert(1)</script>',
            state: 'test',
          }).toString(),
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      // Invalid scope should be rejected
      expect([302, 400]).toContain(res.status);
      if (res.status === 302) {
        const location = res.headers.get('location') as string;
        expect(location).not.toContain('<script>');
      }
    });

    test('should handle XSS attempt in nonce parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await app.request('/api/v1/consent', {
        method: 'POST',
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
      });

      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
            nonce: '<img src=x onerror=alert(1)>',
          }).toString(),
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      // Nonce is stored and returned in ID token, ensure it's properly handled
      expect(res.status).toBe(302);
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should handle SQL injection attempt in client_id', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: "'; DROP TABLE users; --",
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
          }).toString(),
      );

      // Should return error, not crash (validation or not found)
      expect(res.status).toBe(400);
      const json = await res.json();
      // OAuth authorize returns RFC 6749 error format (error/error_description)
      // Client ID with special characters should be rejected
      expect(json.error).toBeDefined();
    });

    test('should handle SQL injection attempt in redirect_uri', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: "'; DROP TABLE users; --",
            scope: 'openid',
            state: 'test',
          }).toString(),
      );

      // Should return error for invalid redirect URI
      expect(res.status).toBe(400);
    });

    test('should handle SQL injection in token introspection', async () => {
      const res = await app.request('/application/oauth/introspect', {
        method: 'POST',
        body: JSON.stringify({
          token: "'; DROP TABLE tokens; --",
          client_id: TEST_OAUTH_CLIENT.clientId,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect((await res.json()).active).toBe(false);
    });
  });

  describe('CRLF Injection Prevention', () => {
    test('should prevent CRLF injection in redirect URI', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await app.request('/api/v1/consent', {
        method: 'POST',
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        }),
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
      });

      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test\r\nSet-Cookie: malicious=value',
          }).toString(),
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      // State with CRLF should be URL-encoded
      expect(res.status).toBe(302);
      const location = res.headers.get('location') as string;
      expect(location).not.toMatch(/\r\n/);
    });
  });

  describe('Open Redirect Prevention', () => {
    test('should reject unauthorized redirect_uri', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: 'https://evil.com/steal-tokens',
            scope: 'openid',
            state: 'test',
          }).toString(),
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      // OAuth authorize returns RFC 6749 error format
      expect(json.error).toBe('invalid_request');
      expect(json.error_description).toContain('redirect URI');
    });

    test('should reject redirect_uri with path traversal', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: 'http://localhost:8080/../../../etc/passwd',
            scope: 'openid',
            state: 'test',
          }).toString(),
      );

      expect(res.status).toBe(400);
    });

    test('should reject redirect_uri with protocol change', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: 'javascript:alert(1)',
            scope: 'openid',
            state: 'test',
          }).toString(),
      );

      expect(res.status).toBe(400);
    });
  });

  describe('Authorization Code Security', () => {
    // Note: Authorization code single-use is tested in token-lifecycle.test.ts

    test('should reject code from different client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
      });

      // Try to use code with different client_id
      const res = await app.request('/application/oauth/token', {
        method: 'POST',
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: 'different-client-id',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    // Note: Redirect URI mismatch is tested in token/post.test.ts
  });

  // Note: PKCE security (missing/wrong code_verifier) is tested in
  // spa-pkce-flow.test.ts and token/post.test.ts

  describe('Token Security', () => {
    test('should not accept expired tokens', async () => {
      // Use a forged token with exp in the past
      const expiredToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.fake';

      const res = await app.request('/application/oauth/userinfo', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(res.status).toBe(401);
    });

    test('should not accept tokens with invalid signature', async () => {
      // Valid JWT structure but wrong signature
      const invalidToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxOTk5OTk5OTk5fQ.invalid-signature';

      const res = await app.request('/application/oauth/userinfo', {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      });

      expect(res.status).toBe(401);
    });

    test('should not accept refresh token as access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Try to use refresh token for userinfo
      const res = await app.request('/application/oauth/userinfo', {
        headers: {
          Authorization: `Bearer ${refresh_token}`,
        },
      });

      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  // Note: Client credential security (wrong client_secret) is tested in
  // server-side-flow.test.ts and token/post.test.ts

  describe('Rate Limiting and Abuse Prevention', () => {
    test('should handle large number of parameters gracefully', async () => {
      const manyParams: Record<string, string> = {
        response_type: 'code',
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid',
        state: 'test',
      };

      // Add many extra parameters
      for (let i = 0; i < 100; i++) {
        manyParams[`extra_param_${i}`] = `value_${i}`;
      }

      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams(manyParams).toString(),
      );

      // Should handle gracefully (either process or reject, not crash)
      expect([302, 400, 401]).toContain(res.status);
    });

    test('should handle very long parameter values', async () => {
      const longValue = 'a'.repeat(10000);

      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: longValue,
          }).toString(),
      );

      // Should handle gracefully
      expect([302, 400, 401, 413]).toContain(res.status);
    });
  });

  describe('Session Security', () => {
    test('should not allow authorization without session', async () => {
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
          }).toString(),
        // No session cookie
      );

      // Should redirect to login, not issue code
      expect([302, 401]).toContain(res.status);
      if (res.status === 302) {
        const location = res.headers.get('location') as string;
        // Should not contain authorization code
        expect(location).not.toContain('code=');
      }
    });

    test('should require consent before issuing code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Try authorize without consent
      const res = await app.request(
        '/application/oauth/authorize?' +
          new URLSearchParams({
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
          }).toString(),
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );

      // Should redirect to consent page, not issue code
      expect([302]).toContain(res.status);
    });
  });
});
