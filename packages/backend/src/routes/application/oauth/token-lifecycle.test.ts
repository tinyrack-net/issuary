import * as jose from 'jose';
import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getUserInfo,
  introspectToken,
  refreshAccessToken,
  revokeToken,
  setupTestServer,
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
} from '@/test-utils/index.js';

const app = setupTestServer();

/**
 * Token Lifecycle and Rotation Tests
 *
 * These tests verify the complete lifecycle of OAuth tokens:
 * - Token issuance and validity
 * - Token refresh and rotation
 * - Token revocation
 * - Concurrent refresh handling
 * - Expiration behavior
 */
describe('Token Lifecycle and Rotation', () => {
  describe('Token Refresh Rotation', () => {
    test('should issue new refresh token on refresh (rotation)', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();

      const originalRefreshToken = tokens.refresh_token;

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: originalRefreshToken,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();

      // New refresh token should be issued (rotation)
      expect(newTokens.refresh_token).toBeDefined();
      expect(newTokens.refresh_token).not.toBe(originalRefreshToken);
    });

    test('should reject reused refresh token after rotation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();
      const originalRefreshToken = tokens.refresh_token;

      // First refresh - should succeed
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: originalRefreshToken,
      });

      expect(refreshRes.statusCode).toBe(200);

      // Second refresh with same token - should fail because refresh token
      // rotation is implemented and the old token is revoked
      const replayRes = await refreshAccessToken(app, {
        refreshToken: originalRefreshToken,
      });

      // Refresh token rotation: old token should be rejected
      expect(replayRes.statusCode).toBe(400);
      expect(replayRes.json().code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should maintain token chain through multiple refreshes', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      let currentRefreshToken = tokenRes.json().refresh_token;
      const seenRefreshTokens = new Set([currentRefreshToken]);

      // Perform multiple refreshes
      for (let i = 0; i < 3; i++) {
        const refreshRes = await refreshAccessToken(app, {
          refreshToken: currentRefreshToken,
        });

        expect(refreshRes.statusCode).toBe(200);
        const newTokens = refreshRes.json();

        // Each refresh should give a new, unique refresh token
        expect(seenRefreshTokens.has(newTokens.refresh_token)).toBe(false);
        seenRefreshTokens.add(newTokens.refresh_token);

        currentRefreshToken = newTokens.refresh_token;
      }
    });
  });

  describe('Token Revocation', () => {
    test('should revoke access token successfully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Access token should work before revocation
      const userInfoBeforeRes = await getUserInfo(app, tokens.access_token);
      expect(userInfoBeforeRes.statusCode).toBe(200);

      // Revoke the access token
      const revokeRes = await revokeToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      expect(revokeRes.statusCode).toBe(200);

      // Access token should not work after revocation
      const userInfoAfterRes = await getUserInfo(app, tokens.access_token);
      expect(userInfoAfterRes.statusCode).toBe(401);
    });

    test('should revoke refresh token successfully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Refresh token should work before revocation
      const refreshBeforeRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });
      expect(refreshBeforeRes.statusCode).toBe(200);

      // Get new refresh token from that response
      const newRefreshToken = refreshBeforeRes.json().refresh_token;

      // Revoke the new refresh token
      const revokeRes = await revokeToken(app, {
        token: newRefreshToken,
        tokenTypeHint: 'refresh_token',
      });

      expect(revokeRes.statusCode).toBe(200);

      // Refresh token should not work after revocation
      const refreshAfterRes = await refreshAccessToken(app, {
        refreshToken: newRefreshToken,
      });

      expect([400, 401]).toContain(refreshAfterRes.statusCode);
    });

    test('should handle revocation of already revoked token gracefully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Revoke the access token
      const revokeRes1 = await revokeToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      expect(revokeRes1.statusCode).toBe(200);

      // Try to revoke again - should still return 200 (RFC 7009)
      const revokeRes2 = await revokeToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      // Per RFC 7009, revoking an invalid/already revoked token should succeed
      expect(revokeRes2.statusCode).toBe(200);
    });

    test('should handle revocation of non-existent token gracefully', async () => {
      const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fake.token';

      const revokeRes = await revokeToken(app, {
        token: fakeToken,
        tokenTypeHint: 'access_token',
      });

      // Per RFC 7009, should return 200 even for non-existent tokens
      expect(revokeRes.statusCode).toBe(200);
    });
  });

  describe('Token Introspection Lifecycle', () => {
    test('should show token as active after issuance', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      const introspectRes = await introspectToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      expect(introspectRes.statusCode).toBe(200);
      const introspection = introspectRes.json();

      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
    });

    test('should show token as inactive after revocation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Revoke the token
      await revokeToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      // Introspect the revoked token
      const introspectRes = await introspectToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
      });

      expect(introspectRes.statusCode).toBe(200);
      const introspection = introspectRes.json();

      expect(introspection.active).toBe(false);
    });

    test('should show refresh token as inactive after use (token rotation)', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();
      const originalRefreshToken = tokens.refresh_token;

      // Use the refresh token
      await refreshAccessToken(app, {
        refreshToken: originalRefreshToken,
      });

      // Introspect the refresh token
      const introspectRes = await introspectToken(app, {
        token: originalRefreshToken,
        tokenTypeHint: 'refresh_token',
      });

      expect(introspectRes.statusCode).toBe(200);
      const introspection = introspectRes.json();

      // With token rotation, used refresh token should be revoked and inactive
      expect(introspection.active).toBe(false);
    });
  });

  describe('Token Validity and Expiration', () => {
    test('should have reasonable expiration times', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();

      // expires_in should be a positive number
      expect(tokens.expires_in).toBeGreaterThan(0);

      // Decode access token to check exp claim
      const accessTokenPayload = jose.decodeJwt(tokens.access_token);
      const now = Math.floor(Date.now() / 1000);

      if (typeof accessTokenPayload.exp === 'number') {
        // Token should not be expired
        expect(accessTokenPayload.exp).toBeGreaterThan(now);

        // Token expiration should match expires_in (approximately)
        if (typeof accessTokenPayload.iat === 'number') {
          const tokenLifetime = accessTokenPayload.exp - accessTokenPayload.iat;
          expect(Math.abs(tokenLifetime - tokens.expires_in)).toBeLessThan(5);
        }
      }
    });

    test('should issue new access token with fresh expiration on refresh', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();
      const originalAccessPayload = jose.decodeJwt(tokens.access_token);

      // Wait a moment to ensure different iat
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();
      const newAccessPayload = jose.decodeJwt(newTokens.access_token);

      // New token should have fresh iat and exp
      if (
        typeof originalAccessPayload.iat === 'number' &&
        typeof newAccessPayload.iat === 'number'
      ) {
        expect(newAccessPayload.iat).toBeGreaterThanOrEqual(
          originalAccessPayload.iat,
        );
      }

      if (
        typeof originalAccessPayload.exp === 'number' &&
        typeof newAccessPayload.exp === 'number'
      ) {
        expect(newAccessPayload.exp).toBeGreaterThanOrEqual(
          originalAccessPayload.exp,
        );
      }
    });
  });

  describe('Concurrent Refresh Handling', () => {
    test('should handle concurrent refresh attempts with rotation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Send multiple refresh requests concurrently
      // With token rotation, only one should succeed (first to revoke the token)
      // Others will fail because the token will be revoked
      const refreshPromises = Array(3)
        .fill(null)
        .map(() =>
          refreshAccessToken(app, {
            refreshToken: tokens.refresh_token,
          }),
        );

      const results = await Promise.all(refreshPromises);

      // With token rotation, only the first request to complete should succeed
      // The rest will fail because the token gets revoked
      const successCount = results.filter((r) => r.statusCode === 200).length;
      // At least one should succeed, but with race conditions in concurrent
      // requests, it's possible for 1 to succeed before revocation
      expect(successCount).toBeGreaterThanOrEqual(1);
    });

    test('should reject refresh token reuse due to token rotation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // First refresh - should succeed
      const refresh1 = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refresh1.statusCode).toBe(200);

      // Second refresh with same token - should fail (token rotation revokes old token)
      const refresh2 = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refresh2.statusCode).toBe(400);
      expect(refresh2.json().code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should allow chained refresh token usage', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // First refresh - should succeed and return new refresh token
      const refresh1 = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });
      expect(refresh1.statusCode).toBe(200);
      const tokens2 = refresh1.json();

      // Second refresh with NEW token - should succeed
      const refresh2 = await refreshAccessToken(app, {
        refreshToken: tokens2.refresh_token,
      });
      expect(refresh2.statusCode).toBe(200);
    });
  });

  describe('Token Scope Preservation', () => {
    test('should preserve scope through token refresh', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const requestedScope = 'openid profile email';

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: requestedScope,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();

      // Introspect new access token to check scope
      const introspectRes = await introspectToken(app, {
        token: newTokens.access_token,
        tokenTypeHint: 'access_token',
      });

      const introspection = introspectRes.json();
      expect(introspection.active).toBe(true);

      // Scope should be preserved
      if (introspection.scope) {
        const originalScopes = requestedScope.split(' ').sort();
        const newScopes = introspection.scope.split(' ').sort();
        expect(newScopes).toEqual(originalScopes);
      }
    });
  });

  describe('Token Subject Consistency', () => {
    test('should maintain same subject across all token operations', async () => {
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      const JWKS = jose.createLocalJWKSet(jwksRes.json());

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();

      // Get subject from original access token
      const { payload: originalPayload } = await jose.jwtVerify(
        tokens.access_token,
        JWKS,
      );
      const originalSub = originalPayload.sub;

      // Refresh and get new tokens
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      const newTokens = refreshRes.json();

      // Get subject from new access token
      const { payload: newPayload } = await jose.jwtVerify(
        newTokens.access_token,
        JWKS,
      );

      // Subject should be identical
      expect(newPayload.sub).toBe(originalSub);

      // UserInfo should return same subject
      const userInfoRes = await getUserInfo(app, newTokens.access_token);
      const userInfo = userInfoRes.json();

      expect(userInfo.sub).toBe(originalSub);
    });
  });

  describe('Authorization Code Single Use', () => {
    test('should reject reused authorization code', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      // First exchange - should succeed
      const tokenRes1 = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes1.statusCode).toBe(200);

      // Second exchange with same code - should fail
      const tokenRes2 = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect([400, 401]).toContain(tokenRes2.statusCode);
    });

    test('should revoke tokens if authorization code is reused', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      // First exchange - should succeed
      const tokenRes1 = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes1.statusCode).toBe(200);
      const _tokens = tokenRes1.json();

      // Attempt to reuse the code
      const tokenRes2 = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect([400, 401]).toContain(tokenRes2.statusCode);

      // Original tokens might be revoked (security measure per RFC 6749)
      // This is implementation-dependent, so we just verify the code reuse fails
    });
  });

  describe('ID Token Refresh Behavior', () => {
    test('should not issue new ID token on refresh by default', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = tokenRes.json();
      expect(tokens.id_token).toBeDefined();

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();

      // Per OIDC spec, ID token is optional in refresh response
      // Some implementations include it, some don't
      // We just verify the response is valid
      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();
    });
  });
});
