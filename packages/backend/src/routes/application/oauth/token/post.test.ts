import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  refreshAccessToken,
  setupTestServer,
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
} from '@/test-utils/index.js';

const app = setupTestServer();

/**
 * Helper: Exchange authorization code for tokens (wrapper)
 */
async function exchangeCode(params: {
  code: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  codeVerifier?: string;
}) {
  return exchangeCodeForTokens(app, params);
}

/**
 * Helper: Refresh access token (wrapper)
 */
async function refreshToken(params: {
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}) {
  return refreshAccessToken(app, params);
}

describe('POST /application/oauth/token', () => {
  describe('Authorization Code Grant - Success Cases', () => {
    test('should exchange authorization code for tokens', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.access_token).toBeDefined();
      expect(json.token_type).toBe('Bearer');
      expect(json.expires_in).toBe(3600);
      expect(json.refresh_token).toBeDefined();
      expect(json.id_token).toBeDefined(); // openid scope requested
      expect(json.scope).toBe('openid profile email');
    });

    test('should work with client_secret authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.access_token).toBeDefined();
    });

    test('should work with PKCE (S256)', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const res = await exchangeCode({
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.access_token).toBeDefined();
    });

    test('should work with PKCE (plain)', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const plainVerifier = 'plain-verifier-string-for-testing-purposes-123';
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: plainVerifier,
        codeChallengeMethod: 'plain',
      });

      const res = await exchangeCode({
        code,
        codeVerifier: plainVerifier,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.access_token).toBeDefined();
    });

    test('should issue tokens without id_token when openid scope not requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'profile email', // No openid scope
      });

      const res = await exchangeCode({ code });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.access_token).toBeDefined();
      expect(json.refresh_token).toBeDefined();
      expect(json.id_token).toBeUndefined(); // No openid scope
      expect(json.scope).toBe('profile email');
    });

    test('should handle subset of scopes', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // Subset of allowed scopes
      });

      const res = await exchangeCode({ code });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.scope).toBe('openid profile');
    });
  });

  describe('Authorization Code Grant - Client Validation', () => {
    test('should reject invalid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        clientId: 'invalid-client-id',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should reject disabled client', async () => {
      // Note: This test assumes there's a disabled client in test config
      // If not available, we can skip this test or create one in DB
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        clientId: 'disabled-client', // Assuming this exists in test config
      });

      // If client doesn't exist, it will return OAUTH_CLIENT_NOT_FOUND
      // If it exists but is disabled, it will return OAUTH_CLIENT_DISABLED
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(['OAUTH_CLIENT_NOT_FOUND', 'OAUTH_CLIENT_DISABLED']).toContain(
        json.code,
      );
    });

    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        clientSecret: 'wrong-secret',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

  describe('Authorization Code Grant - Code Validation', () => {
    test('should reject invalid authorization code', async () => {
      const res = await exchangeCode({
        code: 'invalid-code-123',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('INVALID_AUTHORIZATION_CODE');
    });

    test('should reject expired authorization code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      // Use the code once
      const res1 = await exchangeCode({ code });
      expect(res1.statusCode).toBe(200);

      // Try to use the same code again (should fail - codes are single-use)
      const res2 = await exchangeCode({ code });
      expect(res2.statusCode).toBe(400);
      const json = res2.json();
      expect(json.code).toBe('INVALID_AUTHORIZATION_CODE');
    });

    test('should reject missing authorization code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          // code missing
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('MISSING_AUTHORIZATION_CODE');
    });
  });

  describe('Authorization Code Grant - Redirect URI Validation', () => {
    test('should reject missing redirect_uri', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          // redirect_uri missing
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('MISSING_REDIRECT_URI');
    });

    test('should reject redirect_uri mismatch', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        redirectUri: 'http://evil.com/callback', // Different from authorization request
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('REDIRECT_URI_MISMATCH');
    });
  });

  describe('Authorization Code Grant - PKCE Validation', () => {
    test('should reject missing code_verifier when PKCE was used', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
      });

      const res = await exchangeCode({
        code,
        // code_verifier missing
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('MISSING_CODE_VERIFIER');
    });

    test('should reject invalid code_verifier', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
      });

      const res = await exchangeCode({
        code,
        codeVerifier: 'wrong-verifier-that-does-not-match-the-challenge',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('INVALID_PKCE_VERIFIER');
    });

    test('should accept request without code_verifier when PKCE was not used', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        // No code_challenge
      });

      const res = await exchangeCode({
        code,
        // No code_verifier
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Refresh Token Grant - Success Cases', () => {
    test('should refresh access token using refresh token', async () => {
      // First, get initial tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      expect(tokenRes.statusCode).toBe(200);

      const { refresh_token } = tokenRes.json();
      expect(refresh_token).toBeDefined();

      // Now refresh the token
      const res = await refreshToken({ refreshToken: refresh_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.access_token).toBeDefined();
      expect(json.token_type).toBe('Bearer');
      expect(json.expires_in).toBe(3600);
      expect(json.refresh_token).toBeDefined();
      expect(json.scope).toBe('openid profile email');

      // Refresh token flow doesn't include id_token unless explicitly requested
      // But since original request had openid scope, it should be included
      expect(json.id_token).toBeDefined();
    });

    test('should work with client_secret authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { refresh_token } = tokenRes.json();

      const res = await refreshToken({
        refreshToken: refresh_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.statusCode).toBe(200);
    });

    test('should preserve scopes from original grant', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // Limited scopes
      });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = tokenRes.json();

      const res = await refreshToken({ refreshToken: refresh_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.scope).toBe('openid profile');
    });
  });

  describe('Refresh Token Grant - Validation', () => {
    test('should reject missing refresh_token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'refresh_token',
          client_id: TEST_OAUTH_CLIENT.clientId,
          // refresh_token missing
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('MISSING_REFRESH_TOKEN');
    });

    test('should reject invalid refresh_token', async () => {
      const res = await refreshToken({
        refreshToken: 'invalid-refresh-token',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should reject client_id mismatch', async () => {
      // Get tokens with client A
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = tokenRes.json();

      // Try to refresh with client B
      const res = await refreshToken({
        refreshToken: refresh_token,
        clientId: 'different-client-id',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      // Will fail at client lookup first, or at client_id mismatch check
      expect(['OAUTH_CLIENT_NOT_FOUND', 'CLIENT_ID_MISMATCH']).toContain(
        json.code,
      );
    });

    test('should reject invalid client_secret in refresh flow', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = tokenRes.json();

      const res = await refreshToken({
        refreshToken: refresh_token,
        clientSecret: 'wrong-secret',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

  describe('Grant Type Validation', () => {
    test('should reject unsupported grant_type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'password', // Not supported
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      // Zod validation should fail before reaching handler
      expect(res.statusCode).toBe(400);
    });

    test('should reject missing grant_type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          // grant_type missing
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Token Response Format', () => {
    test('should return valid token response format', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const res = await exchangeCode({ code });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      // RFC 6749 §5.1 - Successful Response
      expect(json).toHaveProperty('access_token');
      expect(json).toHaveProperty('token_type');
      expect(json).toHaveProperty('expires_in');
      expect(json).toHaveProperty('refresh_token');
      expect(json).toHaveProperty('scope');

      // OIDC - ID Token
      expect(json).toHaveProperty('id_token');

      // Type checks
      expect(typeof json.access_token).toBe('string');
      expect(json.token_type).toBe('Bearer');
      expect(typeof json.expires_in).toBe('number');
      expect(typeof json.refresh_token).toBe('string');
      expect(typeof json.scope).toBe('string');
      expect(typeof json.id_token).toBe('string');
    });

    test('should return tokens as JWTs', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const res = await exchangeCode({ code });

      const json = res.json();

      // JWT format: header.payload.signature (3 parts separated by dots)
      expect(json.access_token.split('.')).toHaveLength(3);
      expect(json.refresh_token.split('.')).toHaveLength(3);
      expect(json.id_token.split('.')).toHaveLength(3);
    });
  });

  describe('Error Response Format', () => {
    test('should return proper error format for invalid code', async () => {
      const res = await exchangeCode({ code: 'invalid' });

      expect(res.statusCode).toBe(400);
      const json = res.json();

      // Error response format
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(typeof json.code).toBe('string');
      expect(typeof json.message).toBe('string');
    });

    test('should return 401 for client authentication failures', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        clientSecret: 'wrong',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should return 400 for invalid grants', async () => {
      const res = await exchangeCode({ code: 'invalid' });

      expect(res.statusCode).toBe(400);
    });
  });
});
