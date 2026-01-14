import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  refreshAccessToken,
  setupTestServer,
  TEST_OAUTH_CLIENT,
} from '@/test-utils/index.js';

const app = setupTestServer();

/**
 * Helper: Revoke a token
 */
async function revokeToken(params: {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
  clientId?: string;
  clientSecret?: string;
}) {
  return app.inject({
    method: 'POST',
    url: '/application/oauth/revoke',
    payload: {
      token: params.token,
      ...(params.tokenTypeHint && { token_type_hint: params.tokenTypeHint }),
      ...(params.clientId && { client_id: params.clientId }),
      ...(params.clientSecret && { client_secret: params.clientSecret }),
    },
  });
}

/**
 * Helper: Introspect a token
 */
async function introspectToken(token: string) {
  return app.inject({
    method: 'POST',
    url: '/application/oauth/introspect',
    payload: {
      token,
      client_id: TEST_OAUTH_CLIENT.clientId,
    },
  });
}

describe('POST /application/oauth/revoke', () => {
  describe('Access Token Revocation', () => {
    test('should revoke valid access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Verify token is active before revocation
      const introspectBefore = await introspectToken(access_token);
      expect(introspectBefore.json().active).toBe(true);

      // Revoke the token
      const res = await revokeToken({ token: access_token });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});

      // Verify token is inactive after revocation
      const introspectAfter = await introspectToken(access_token);
      expect(introspectAfter.json().active).toBe(false);
    });

    test('should revoke access token with token_type_hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        tokenTypeHint: 'access_token',
      });

      expect(res.statusCode).toBe(200);

      // Verify token is inactive
      const introspectRes = await introspectToken(access_token);
      expect(introspectRes.json().active).toBe(false);
    });

    test('should return 200 for already revoked access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Revoke twice
      const res1 = await revokeToken({ token: access_token });
      expect(res1.statusCode).toBe(200);

      const res2 = await revokeToken({ token: access_token });
      expect(res2.statusCode).toBe(200);
    });
  });

  describe('Refresh Token Revocation', () => {
    test('should revoke valid refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      // Verify token is active before revocation
      const introspectBefore = await introspectToken(refresh_token);
      expect(introspectBefore.json().active).toBe(true);

      // Revoke the token
      const res = await revokeToken({ token: refresh_token });

      expect(res.statusCode).toBe(200);

      // Verify token is inactive after revocation
      const introspectAfter = await introspectToken(refresh_token);
      expect(introspectAfter.json().active).toBe(false);
    });

    test('should revoke refresh token with token_type_hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      const res = await revokeToken({
        token: refresh_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.statusCode).toBe(200);

      // Verify token is inactive
      const introspectRes = await introspectToken(refresh_token);
      expect(introspectRes.json().active).toBe(false);
    });

    test('should prevent token refresh after revocation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      // Revoke the refresh token
      await revokeToken({ token: refresh_token });

      // Try to use the revoked refresh token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: refresh_token,
      });

      expect(refreshRes.statusCode).toBe(400);
      expect(refreshRes.json().code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Invalid Token Handling (RFC 7009 §2.1)', () => {
    test('should return 200 for invalid token string', async () => {
      const res = await revokeToken({
        token: 'invalid-token-string',
      });

      // RFC 7009 §2.1: Returns 200 even for invalid tokens
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    test('should return 200 for malformed JWT', async () => {
      const res = await revokeToken({
        token: 'not.a.valid.jwt.format',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    test('should return 200 for JWT with invalid signature', async () => {
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const res = await revokeToken({ token: fakeToken });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    test('should reject empty token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/revoke',
        payload: {
          token: '',
        },
      });

      // Zod validation should fail for empty string
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Client Authentication', () => {
    test('should work without client authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({ token: access_token });

      expect(res.statusCode).toBe(200);
    });

    test('should work with valid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
      });

      expect(res.statusCode).toBe(200);
    });

    test('should work with valid client_id and client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.statusCode).toBe(200);
    });

    test('should reject invalid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: 'invalid-client-id',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: 'wrong-secret',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject disabled client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: 'disabled-client',
      });

      expect(res.statusCode).toBe(400);
      expect(['OAUTH_CLIENT_NOT_FOUND', 'OAUTH_CLIENT_DISABLED']).toContain(
        res.json().code,
      );
    });
  });

  describe('Token Type Hint Handling', () => {
    test('should handle wrong token_type_hint gracefully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Hint says refresh_token but it's actually access_token
      const res = await revokeToken({
        token: access_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.statusCode).toBe(200);

      // Token should still be revoked
      const introspectRes = await introspectToken(access_token);
      expect(introspectRes.json().active).toBe(false);
    });

    test('should handle refresh token with access_token hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      // Hint says access_token but it's actually refresh_token
      const res = await revokeToken({
        token: refresh_token,
        tokenTypeHint: 'access_token',
      });

      expect(res.statusCode).toBe(200);

      // Token should still be revoked
      const introspectRes = await introspectToken(refresh_token);
      expect(introspectRes.json().active).toBe(false);
    });
  });

  describe('Response Format', () => {
    test('should return empty object on success', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await revokeToken({ token: access_token });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    test('should return proper error format for client errors', async () => {
      const res = await revokeToken({
        token: 'some-token',
        clientId: 'invalid-client',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(typeof json.code).toBe('string');
      expect(typeof json.message).toBe('string');
    });
  });

  describe('Integration with Other Endpoints', () => {
    test('revoked access token should fail userinfo request', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Revoke the access token
      await revokeToken({ token: access_token });

      // Try to use the revoked token for userinfo
      const userinfoRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/userinfo',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      expect(userinfoRes.statusCode).toBe(401);
    });

    test('revoked token should show as inactive in introspection', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token, refresh_token } = tokenRes.json();

      // Revoke both tokens
      await revokeToken({ token: access_token });
      await revokeToken({ token: refresh_token });

      // Both should show as inactive
      const accessIntrospect = await introspectToken(access_token);
      const refreshIntrospect = await introspectToken(refresh_token);

      expect(accessIntrospect.json().active).toBe(false);
      expect(refreshIntrospect.json().active).toBe(false);
    });
  });

  describe('Request Validation', () => {
    test('should reject request without token field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/revoke',
        payload: {
          // No token field
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should handle very long token gracefully', async () => {
      const longToken = 'a'.repeat(10000);

      const res = await revokeToken({ token: longToken });

      // RFC 7009 says to return 200 even for invalid tokens
      expect(res.statusCode).toBe(200);
    });

    test('should handle special characters in token gracefully', async () => {
      const specialToken = 'token<script>alert(1)</script>token';

      const res = await revokeToken({ token: specialToken });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Idempotency', () => {
    test('should be idempotent for same token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Revoke multiple times
      const res1 = await revokeToken({ token: access_token });
      const res2 = await revokeToken({ token: access_token });
      const res3 = await revokeToken({ token: access_token });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(200);

      // Token should still be inactive
      const introspectRes = await introspectToken(access_token);
      expect(introspectRes.json().active).toBe(false);
    });
  });
});
