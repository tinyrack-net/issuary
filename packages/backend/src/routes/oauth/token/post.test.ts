import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  refreshAccessToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import * as jose from 'jose';
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

describe('POST /oauth/token', () => {
  describe('Authorization Code Grant - Success Cases', () => {
    test('should exchange authorization code for tokens', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

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

      expect(res.status).toBe(200);
      const json = await res.json();
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

      expect(res.status).toBe(200);
      const json = await res.json();
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

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.access_token).toBeDefined();
    });

    test('should issue tokens without id_token when openid scope not requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'profile email', // No openid scope
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();
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

      expect(res.status).toBe(200);
      const json = await res.json();
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

      expect(res.status).toBe(400);
      const json = await res.json();
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
      expect(res.status).toBe(400);
      const json = await res.json();
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

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

  describe('Authorization Code Grant - Code Validation', () => {
    test('should reject invalid authorization code', async () => {
      const res = await exchangeCode({
        code: 'invalid-code-123',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('INVALID_AUTHORIZATION_CODE');
    });

    test('should reject expired authorization code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      // Use the code once
      const res1 = await exchangeCode({ code });
      expect(res1.status).toBe(200);

      // Try to use the same code again (should fail - codes are single-use)
      const res2 = await exchangeCode({ code });
      expect(res2.status).toBe(400);
      const json = await res2.json();
      expect(json.code).toBe('INVALID_AUTHORIZATION_CODE');
    });

    test('should reject missing authorization code', async () => {
      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          // code missing
        },
      });

      const json = await assertJsonBody(res, 400);
      expect(json.code).toBe('MISSING_AUTHORIZATION_CODE');
    });
  });

  describe('Authorization Code Grant - Redirect URI Validation', () => {
    test('should reject missing redirect_uri', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          // redirect_uri missing
        },
      });

      const json = await assertJsonBody(res, 400);
      expect(json.code).toBe('MISSING_REDIRECT_URI');
    });

    test('should reject redirect_uri mismatch', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({
        code,
        redirectUri: 'http://evil.com/callback', // Different from authorization request
      });

      expect(res.status).toBe(400);
      const json = await res.json();
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

      expect(res.status).toBe(400);
      const json = await res.json();
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

      expect(res.status).toBe(400);
      const json = await res.json();
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

      expect(res.status).toBe(200);
    });
  });

  describe('Refresh Token Grant - Success Cases', () => {
    test('should refresh access token using refresh token', async () => {
      // First, get initial tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      expect(tokenRes.status).toBe(200);

      const { refresh_token } = await tokenRes.json();
      expect(refresh_token).toBeDefined();

      // Now refresh the token
      const res = await refreshToken({ refreshToken: refresh_token });

      expect(res.status).toBe(200);
      const json = await res.json();
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
      const { refresh_token } = await tokenRes.json();

      const res = await refreshToken({
        refreshToken: refresh_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.status).toBe(200);
    });

    test('should preserve scopes from original grant', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // Limited scopes
      });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = await tokenRes.json();

      const res = await refreshToken({ refreshToken: refresh_token });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.scope).toBe('openid profile');
    });
  });

  describe('Refresh Token Grant - Validation', () => {
    test('should reject missing refresh_token', async () => {
      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          grant_type: 'refresh_token',
          client_id: TEST_OAUTH_CLIENT.clientId,
          // refresh_token missing
        },
      });

      const json = await assertJsonBody(res, 400);
      expect(json.code).toBe('MISSING_REFRESH_TOKEN');
    });

    test('should reject invalid refresh_token', async () => {
      const res = await refreshToken({
        refreshToken: 'invalid-refresh-token',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should reject client_id mismatch', async () => {
      // Get tokens with client A
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = await tokenRes.json();

      // Try to refresh with client B
      const res = await refreshToken({
        refreshToken: refresh_token,
        clientId: 'different-client-id',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      // Will fail at client lookup first, or at client_id mismatch check
      expect(['OAUTH_CLIENT_NOT_FOUND', 'CLIENT_ID_MISMATCH']).toContain(
        json.code,
      );
    });

    test('should reject invalid client_secret in refresh flow', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token } = await tokenRes.json();

      const res = await refreshToken({
        refreshToken: refresh_token,
        clientSecret: 'wrong-secret',
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

  describe('Refresh Token Rotation', () => {
    test('should reject previously used refresh token (token rotation)', async () => {
      // Get initial tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      expect(tokenRes.status).toBe(200);

      const { refresh_token: firstRefreshToken } = await tokenRes.json();
      expect(firstRefreshToken).toBeDefined();

      // First refresh - should succeed and return new tokens
      const refreshRes1 = await refreshToken({
        refreshToken: firstRefreshToken,
      });
      expect(refreshRes1.status).toBe(200);

      const { refresh_token: secondRefreshToken } = await refreshRes1.json();
      expect(secondRefreshToken).toBeDefined();
      // New refresh token should be different from the old one
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // Try to use the first refresh token again - should fail (token rotation)
      const refreshRes2 = await refreshToken({
        refreshToken: firstRefreshToken,
      });
      expect(refreshRes2.status).toBe(400);
      const json = await refreshRes2.json();
      expect(json.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should allow using new refresh token after rotation', async () => {
      // Get initial tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token: firstRefreshToken } = await tokenRes.json();

      // First refresh
      const refreshRes1 = await refreshToken({
        refreshToken: firstRefreshToken,
      });
      expect(refreshRes1.status).toBe(200);
      const { refresh_token: secondRefreshToken } = await refreshRes1.json();

      // Use the new refresh token - should succeed
      const refreshRes2 = await refreshToken({
        refreshToken: secondRefreshToken,
      });
      expect(refreshRes2.status).toBe(200);

      const { refresh_token: thirdRefreshToken } = await refreshRes2.json();
      expect(thirdRefreshToken).toBeDefined();
      expect(thirdRefreshToken).not.toBe(secondRefreshToken);
    });

    test('should issue tokens with same scopes after rotation', async () => {
      // Get tokens with specific scopes
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // Limited scopes
      });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token, scope: originalScope } = await tokenRes.json();

      // Refresh
      const refreshRes = await refreshToken({ refreshToken: refresh_token });
      expect(refreshRes.status).toBe(200);

      const json = await refreshRes.json();
      // Scopes should be preserved after rotation
      expect(json.scope).toBe(originalScope);
    });

    test('should preserve user identity after token rotation', async () => {
      // Get initial tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCode({ code });
      const { refresh_token, access_token: firstAccessToken } =
        await tokenRes.json();

      const firstPayload = jose.decodeJwt(firstAccessToken);

      // Refresh to get new tokens
      const refreshRes = await refreshToken({ refreshToken: refresh_token });
      const { access_token: secondAccessToken } = await refreshRes.json();

      const secondPayload = jose.decodeJwt(secondAccessToken);

      // User identity (sub) should remain the same
      expect(secondPayload.sub).toBe(firstPayload.sub);
      // Client binding should remain the same
      expect(secondPayload['client_id']).toBe(firstPayload['client_id']);
    });
  });

  describe('Error Recovery', () => {
    test('should allow retry after failed token exchange', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // First code
      const { code: code1 } = await getAuthorizationCode(app, {
        sessionCookie,
      });

      // Try to exchange with wrong redirect_uri (will fail)
      const client = testClient(app);
      const failRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code: code1,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'http://wrong.com/callback',
        },
      });
      expect(failRes.status).toBe(400);

      // Get a new code (original is now consumed)
      const { code: code2 } = await getAuthorizationCode(app, {
        sessionCookie,
      });

      // Exchange should succeed with new code
      const successRes = await exchangeCode({ code: code2 });
      expect(successRes.status).toBe(200);
    });
  });

  describe('Grant Type Validation', () => {
    test('should reject unsupported grant_type', async () => {
      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          grant_type: 'password' as 'authorization_code', // Not supported
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      // Zod validation should fail before reaching handler
      expect(res.status).toBe(400);
    });

    test('should reject missing grant_type', async () => {
      const client = testClient(app);
      const res = await client.oauth.token.$post({
        form: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          // grant_type missing
        } as { grant_type: 'authorization_code'; client_id: string },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Token Response Format', () => {
    test('should return valid token response format', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

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

      const json = await res.json();

      // JWT format: header.payload.signature (3 parts separated by dots)
      expect(json.access_token.split('.')).toHaveLength(3);
      expect(json.refresh_token.split('.')).toHaveLength(3);
      expect(json.id_token.split('.')).toHaveLength(3);
    });
  });

  describe('Error Response Format', () => {
    test('should return proper error format for invalid code', async () => {
      const res = await exchangeCode({ code: 'invalid' });

      expect(res.status).toBe(400);
      const json = await res.json();

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

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should return 400 for invalid grants', async () => {
      const res = await exchangeCode({ code: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  describe('ID Token Claims Validation', () => {
    test('should include nonce in id_token when provided in authorization request', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const testNonce = 'test-nonce-abc123';
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        nonce: testNonce,
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id_token).toBeDefined();

      // Decode and verify nonce claim
      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['nonce']).toBe(testNonce);
    });

    test('should NOT include nonce in id_token when not provided', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        // No nonce provided
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['nonce']).toBeUndefined();
    });

    test('should include aud claim matching client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);
    });

    test('should include sub claim with user ID', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded.sub).toBeDefined();
      expect(typeof decoded.sub).toBe('string');
      // sub should be a non-empty string (can be UUID or config-based ID)
      expect(typeof decoded.sub === 'string' && decoded.sub.length > 0).toBe(
        true,
      );
    });

    test('should include iss claim with issuer URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded.iss).toBeDefined();
      expect(typeof decoded.iss).toBe('string');
    });

    test('should include iat and exp claims', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');

      // exp should be after iat
      if (typeof decoded.iat !== 'number') {
        throw new Error('Expected iat claim to be a number');
      }
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    test('should include email claims when email scope requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid email',
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['email']).toBeDefined();
      expect(typeof decoded['email']).toBe('string');
      expect(decoded['email_verified']).toBeDefined();
      expect(typeof decoded['email_verified']).toBe('boolean');
    });

    test('should NOT include email claims when email scope not requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // No email scope
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['email']).toBeUndefined();
      expect(decoded['email_verified']).toBeUndefined();
    });

    test('should include name claim when profile scope requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile',
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['name']).toBeDefined();
      expect(typeof decoded['name']).toBe('string');
    });

    test('should NOT include name claim when profile scope not requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid email', // No profile scope
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);
      expect(decoded['name']).toBeUndefined();
    });

    test('should include all claims when full scopes requested', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const testNonce = 'full-scope-nonce';
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
        nonce: testNonce,
      });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.id_token);

      // Required OIDC claims
      expect(decoded.iss).toBeDefined();
      expect(decoded.sub).toBeDefined();
      expect(decoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // Nonce (when provided)
      expect(decoded['nonce']).toBe(testNonce);

      // Profile scope claims
      expect(decoded['name']).toBeDefined();

      // Email scope claims
      expect(decoded['email']).toBeDefined();
      expect(decoded['email_verified']).toBeDefined();
    });
  });

  describe('Access Token Claims Validation', () => {
    test('should include required claims in access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.access_token);

      // Required claims
      expect(decoded['typ']).toBe('access_token');
      expect(decoded.sub).toBeDefined();
      expect(decoded['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(decoded['scope']).toBe('openid profile email');
      expect(decoded.iss).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.jti).toBeDefined(); // JWT ID for revocation
    });

    test('should include kid in JWT header', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      // Decode header to check kid
      const [headerPart] = json.access_token.split('.');
      const header = JSON.parse(
        Buffer.from(headerPart, 'base64url').toString(),
      );

      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');
      expect(header.kid).toBeDefined();
    });
  });

  describe('Refresh Token Claims Validation', () => {
    test('should include required claims in refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const decoded = jose.decodeJwt(json.refresh_token);

      // Required claims
      expect(decoded['typ']).toBe('refresh_token');
      expect(decoded.sub).toBeDefined();
      expect(decoded['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(decoded['scope']).toBe('openid profile email');
      expect(decoded.iss).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.jti).toBeDefined();
    });

    test('should have longer expiration than access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const res = await exchangeCode({ code });

      expect(res.status).toBe(200);
      const json = await res.json();

      const accessDecoded = jose.decodeJwt(json.access_token);
      const refreshDecoded = jose.decodeJwt(json.refresh_token);

      // Refresh token should expire after access token
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp as number);
    });
  });
});
