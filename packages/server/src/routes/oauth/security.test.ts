import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
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
      const authClient = testClient(app);
      const sessionHeaders = {
        headers: { Cookie: `session=${sessionCookie}` },
      };
      await authClient.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            decision: 'allow',
            scope: 'openid',
            state: 'test-state',
          },
        },
        sessionHeaders,
      );

      // Try XSS in state parameter
      const res = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: '<script>alert(1)</script>',
          },
        },
        sessionHeaders,
      );

      // Should redirect with URL-encoded state
      expect(res.status).toBe(302);
      const location = getLocationHeader(res);
      expect(location).not.toContain('<script>');
      // State should be URL-encoded (note: Fastify URL-encodes parentheses)
      expect(location).toContain('%3Cscript%3Ealert');
    });

    test('should handle XSS attempt in scope parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const authClient = testClient(app);
      const res = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid<script>alert(1)</script>',
            state: 'test',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Invalid scope should be rejected
      expect([302, 400]).toContain(res.status);
      if (res.status === 302) {
        const location = getLocationHeader(res);
        expect(location).not.toContain('<script>');
      }
    });

    test('should handle XSS attempt in nonce parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const authClient = testClient(app);
      const sessionHeaders = {
        headers: { Cookie: `session=${sessionCookie}` },
      };
      await authClient.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            decision: 'allow',
            scope: 'openid',
            state: 'test-state',
          },
        },
        sessionHeaders,
      );

      const res = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
            nonce: '<img src=x onerror=alert(1)>',
          },
        },
        sessionHeaders,
      );

      // Nonce is stored and returned in ID token, ensure it's properly handled
      expect(res.status).toBe(302);
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should handle SQL injection attempt in client_id', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: "'; DROP TABLE users; --",
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test',
        },
      });

      // Should return error, not crash (validation or not found)
      const json = await assertJsonBody(res, 400);
      // OAuth authorize returns RFC 6749 error format (error/error_description)
      // Client ID with special characters should be rejected
      expect(json.error).toBeDefined();
    });

    test('should handle SQL injection attempt in redirect_uri', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: "'; DROP TABLE users; --",
          scope: 'openid',
          state: 'test',
        },
      });

      // Should return error for invalid redirect URI
      expect(res.status).toBe(400);
    });

    test('should handle SQL injection in token introspection', async () => {
      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        form: {
          token: "'; DROP TABLE tokens; --",
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
        },
      });

      const introspectBody = await assertJsonBody(res);
      expect(introspectBody.active).toBe(false);
    });
  });

  describe('CRLF Injection Prevention', () => {
    test('should prevent CRLF injection in redirect URI', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const authClient = testClient(app);
      const sessionHeaders = {
        headers: { Cookie: `session=${sessionCookie}` },
      };
      await authClient.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            decision: 'allow',
            scope: 'openid',
            state: 'test-state',
          },
        },
        sessionHeaders,
      );

      const res = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test\r\nSet-Cookie: malicious=value',
          },
        },
        sessionHeaders,
      );

      // State with CRLF should be URL-encoded
      expect(res.status).toBe(302);
      const location = getLocationHeader(res);
      expect(location).not.toMatch(/\r\n/);
    });
  });

  describe('Open Redirect Prevention', () => {
    test('should reject unauthorized redirect_uri', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'https://evil.com/steal-tokens',
          scope: 'openid',
          state: 'test',
        },
      });

      const json = await assertJsonBody(res, 400);
      // OAuth authorize returns RFC 6749 error format
      expect(json.error).toBe('invalid_request');
      expect(json.error_description).toContain('redirect URI');
    });

    test('should reject redirect_uri with path traversal', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'http://localhost:8080/../../../etc/passwd',
          scope: 'openid',
          state: 'test',
        },
      });

      expect(res.status).toBe(400);
    });

    test('should reject redirect_uri with protocol change', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'javascript:alert(1)',
          scope: 'openid',
          state: 'test',
        },
      });

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
      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: 'different-client-id',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
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

      const client = testClient(app);
      const res = await client.oauth.userinfo.$get(
        {
          header: {},
        },
        { headers: { authorization: `Bearer ${expiredToken}` } },
      );

      expect(res.status).toBe(401);
    });

    test('should not accept tokens with invalid signature', async () => {
      // Valid JWT structure but wrong signature
      const invalidToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxOTk5OTk5OTk5fQ.invalid-signature';

      const client = testClient(app);
      const res = await client.oauth.userinfo.$get(
        {
          header: {},
        },
        { headers: { authorization: `Bearer ${invalidToken}` } },
      );

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
      const client = testClient(app);
      const res = await client.oauth.userinfo.$get(
        {
          header: {},
        },
        { headers: { authorization: `Bearer ${refresh_token}` } },
      );

      const tokenBody = await assertJsonBody(res, 401);
      expect(tokenBody.code).toBe('INVALID_ACCESS_TOKEN');
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

      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: manyParams as Parameters<
          typeof client.oauth.authorize.$get
        >[0]['query'],
      });

      // Should handle gracefully (either process or reject, not crash)
      expect([302, 400, 401]).toContain(res.status);
    });

    test('should handle very long parameter values', async () => {
      const longValue = 'a'.repeat(10000);

      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: longValue,
        },
      });

      // Should handle gracefully
      expect([302, 400, 401, 413]).toContain(res.status);
    });
  });

  describe('Session Security', () => {
    test('should not allow authorization without session', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test',
        },
        // No session cookie
      });

      // Should redirect to login, not issue code
      expect([302, 401]).toContain(res.status);
      if (res.status === 302) {
        const location = getLocationHeader(res);
        // Should not contain authorization code
        expect(location).not.toContain('code=');
      }
    });

    test('should require consent before issuing code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Try authorize without consent
      const authClient = testClient(app);
      const res = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            state: 'test',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Should redirect to consent page, not issue code
      expect([302]).toContain(res.status);
    });
  });
});
