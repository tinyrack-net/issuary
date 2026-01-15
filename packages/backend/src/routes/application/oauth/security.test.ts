import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  setupTestServer,
  TEST_OAUTH_CLIENT,
} from '@/test-utils/index.js';

const app = setupTestServer();

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
      await app.inject({
        method: 'POST',
        url: '/api/v1/consent',
        cookies: { session: sessionCookie },
        payload: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        },
      });

      // Try XSS in state parameter
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: '<script>alert(1)</script>',
        },
        cookies: { session: sessionCookie },
      });

      // Should redirect with URL-encoded state
      expect(res.statusCode).toBe(302);
      const location = res.headers.location as string;
      expect(location).not.toContain('<script>');
      // State should be URL-encoded (note: Fastify URL-encodes parentheses)
      expect(location).toContain('%3Cscript%3Ealert');
    });

    test('should handle XSS attempt in scope parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid<script>alert(1)</script>',
          state: 'test',
        },
        cookies: { session: sessionCookie },
      });

      // Invalid scope should be rejected
      expect([302, 400]).toContain(res.statusCode);
      if (res.statusCode === 302) {
        const location = res.headers.location as string;
        expect(location).not.toContain('<script>');
      }
    });

    test('should handle XSS attempt in nonce parameter', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await app.inject({
        method: 'POST',
        url: '/api/v1/consent',
        cookies: { session: sessionCookie },
        payload: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test',
          nonce: '<img src=x onerror=alert(1)>',
        },
        cookies: { session: sessionCookie },
      });

      // Nonce is stored and returned in ID token, ensure it's properly handled
      expect(res.statusCode).toBe(302);
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should handle SQL injection attempt in client_id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: "'; DROP TABLE users; --",
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test',
        },
      });

      // Should return error, not crash (validation or not found)
      expect(res.statusCode).toBe(400);
      const json = res.json();
      // OAuth authorize returns RFC 6749 error format (error/error_description)
      // Client ID with special characters should be rejected
      expect(json.error).toBeDefined();
    });

    test('should handle SQL injection attempt in redirect_uri', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: "'; DROP TABLE users; --",
          scope: 'openid',
          state: 'test',
        },
      });

      // Should return error for invalid redirect URI
      expect(res.statusCode).toBe(400);
    });

    test('should handle SQL injection in token introspection', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/introspect',
        payload: {
          token: "'; DROP TABLE tokens; --",
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().active).toBe(false);
    });
  });

  describe('CRLF Injection Prevention', () => {
    test('should prevent CRLF injection in redirect URI', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await app.inject({
        method: 'POST',
        url: '/api/v1/consent',
        cookies: { session: sessionCookie },
        payload: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test-state',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test\r\nSet-Cookie: malicious=value',
        },
        cookies: { session: sessionCookie },
      });

      // State with CRLF should be URL-encoded
      expect(res.statusCode).toBe(302);
      const location = res.headers.location as string;
      expect(location).not.toMatch(/\r\n/);
    });
  });

  describe('Open Redirect Prevention', () => {
    test('should reject unauthorized redirect_uri', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'https://evil.com/steal-tokens',
          scope: 'openid',
          state: 'test',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      // OAuth authorize returns RFC 6749 error format
      expect(json.error).toBe('invalid_request');
      expect(json.error_description).toContain('redirect URI');
    });

    test('should reject redirect_uri with path traversal', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'http://localhost:8080/../../../etc/passwd',
          scope: 'openid',
          state: 'test',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should reject redirect_uri with protocol change', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'javascript:alert(1)',
          scope: 'openid',
          state: 'test',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Authorization Code Security', () => {
    test('should reject reused authorization code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      // First use - should succeed
      const res1 = await exchangeCodeForTokens(app, { code });
      expect(res1.statusCode).toBe(200);

      // Second use - should fail (single-use)
      const res2 = await exchangeCodeForTokens(app, { code });
      expect(res2.statusCode).toBe(400);
      expect(res2.json().code).toBe('INVALID_AUTHORIZATION_CODE');
    });

    test('should reject code from different client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      // Try to use code with different client_id
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: 'different-client-id',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should reject code with different redirect_uri', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'http://different.com/callback',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('REDIRECT_URI_MISMATCH');
    });
  });

  describe('PKCE Security', () => {
    test('should require code_verifier when code_challenge was used', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const _codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      // SHA256 of code_verifier in base64url
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Try without code_verifier
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          // Missing code_verifier
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('MISSING_CODE_VERIFIER');
    });

    test('should reject incorrect code_verifier', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // code_verifier must be 43-128 characters - use a valid length but wrong value
      const wrongVerifier =
        'wrong-verifier-value-that-is-long-enough-to-pass-validation';

      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: wrongVerifier,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_PKCE_VERIFIER');
    });
  });

  describe('Token Security', () => {
    test('should not accept expired tokens', async () => {
      // Use a forged token with exp in the past
      const expiredToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.fake';

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/userinfo',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    test('should not accept tokens with invalid signature', async () => {
      // Valid JWT structure but wrong signature
      const invalidToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxOTk5OTk5OTk5fQ.invalid-signature';

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/userinfo',
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    test('should not accept refresh token as access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      // Try to use refresh token for userinfo
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/userinfo',
        headers: {
          Authorization: `Bearer ${refresh_token}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  describe('Client Credential Security', () => {
    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: 'wrong-secret',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

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

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: manyParams,
      });

      // Should handle gracefully (either process or reject, not crash)
      expect([302, 400, 401]).toContain(res.statusCode);
    });

    test('should handle very long parameter values', async () => {
      const longValue = 'a'.repeat(10000);

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: longValue,
        },
      });

      // Should handle gracefully
      expect([302, 400, 401, 413]).toContain(res.statusCode);
    });
  });

  describe('Session Security', () => {
    test('should not allow authorization without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
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
      expect([302, 401]).toContain(res.statusCode);
      if (res.statusCode === 302) {
        const location = res.headers.location as string;
        // Should not contain authorization code
        expect(location).not.toContain('code=');
      }
    });

    test('should require consent before issuing code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Try authorize without consent
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          state: 'test',
        },
        cookies: { session: sessionCookie },
      });

      // Should redirect to consent page, not issue code
      expect([302]).toContain(res.statusCode);
    });
  });
});
