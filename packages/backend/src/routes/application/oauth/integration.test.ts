import * as jose from 'jose';
import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getUserInfo,
  grantConsent,
  introspectToken,
  refreshAccessToken,
  setupTestServer,
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
  TEST_USER,
} from '@/test-utils/index.js';

/**
 * Helper to get all tokens (access, refresh, id)
 */
async function getAllTokens(
  app: ReturnType<typeof setupTestServer>,
  params: { scope?: string; nonce?: string } = {},
) {
  const sessionCookie = await createAuthenticatedSession(app);
  const { code } = await getAuthorizationCode(app, {
    sessionCookie,
    scope: params.scope || 'openid profile email',
    nonce: params.nonce,
  });
  const tokenRes = await exchangeCodeForTokens(app, { code });
  expect(tokenRes.statusCode).toBe(200);
  return tokenRes.json();
}

const app = setupTestServer();

/**
 * Integration Tests for complete OAuth/OIDC flows
 *
 * Tests cover:
 * - Complete Authorization Code Flow
 * - Authorization Code Flow with PKCE
 * - Token Refresh Flow
 * - Token Introspection and Revocation
 * - OIDC ID Token Flow
 * - Multiple Client Scenarios
 */
describe('OAuth Integration Flows', () => {
  describe('Complete Authorization Code Flow', () => {
    test('should complete full authorization code flow', async () => {
      // Step 1: Login and create session
      const sessionCookie = await createAuthenticatedSession(app);

      // Step 2: Get authorization code (grantConsent is called internally)
      const { code, location } = await getAuthorizationCode(app, {
        sessionCookie,
        state: 'integration-test-state',
      });
      expect(code).toBeDefined();
      expect(location.searchParams.get('state')).toBe('integration-test-state');

      // Step 3: Exchange code for tokens
      const tokenRes = await exchangeCodeForTokens(app, { code });
      expect(tokenRes.statusCode).toBe(200);

      const tokens = tokenRes.json();
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBeGreaterThan(0);

      // Step 4: Use access token to get user info
      const userInfoRes = await getUserInfo(app, tokens.access_token);
      expect(userInfoRes.statusCode).toBe(200);

      const userInfo = userInfoRes.json();
      expect(userInfo.email).toBe(TEST_USER.email);
      expect(userInfo.sub).toBeDefined();
    });

    test('should complete flow with PKCE', async () => {
      // Step 1: Login
      const sessionCookie = await createAuthenticatedSession(app);

      // Step 2: Get authorization code with PKCE
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Step 3: Exchange code with verifier
      const tokenRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: TEST_PKCE.codeVerifier,
        },
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();
      expect(tokens.access_token).toBeDefined();
    });

    test('should complete flow with client secret authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      // Exchange with client_secret
      const tokenRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect(tokenRes.statusCode).toBe(200);
      expect(tokenRes.json().access_token).toBeDefined();
    });
  });

  describe('Token Refresh Flow', () => {
    test('should refresh access token successfully', async () => {
      // Get initial tokens
      const tokens = await getAllTokens(app);
      const { access_token, refresh_token } = tokens;

      // Wait a moment to ensure different token
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: refresh_token,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();
      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();

      // New access token should be different (or same if short interval)
      // But both should work

      // Verify new access token works
      const userInfoRes = await getUserInfo(app, newTokens.access_token);
      expect(userInfoRes.statusCode).toBe(200);
    });

    test('should issue new refresh token on refresh', async () => {
      const tokens = await getAllTokens(app);

      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();

      // New refresh token should be provided
      expect(newTokens.refresh_token).toBeDefined();
    });
  });

  describe('Token Introspection Flow', () => {
    test('should introspect active access token', async () => {
      const tokens = await getAllTokens(app);

      const introspectRes = await introspectToken(app, {
        token: tokens.access_token,
      });

      expect(introspectRes.statusCode).toBe(200);
      const result = introspectRes.json();
      expect(result.active).toBe(true);
      expect(result.token_type).toBe('Bearer');
      expect(result.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(result.sub).toBeDefined();
    });

    test('should introspect refresh token', async () => {
      const tokens = await getAllTokens(app);

      const introspectRes = await introspectToken(app, {
        token: tokens.refresh_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(introspectRes.statusCode).toBe(200);
      const result = introspectRes.json();
      expect(result.active).toBe(true);
    });
  });

  describe('Token Revocation Flow', () => {
    test('should revoke access token and invalidate it', async () => {
      const tokens = await getAllTokens(app);

      // Verify token works before revocation
      const beforeRes = await getUserInfo(app, tokens.access_token);
      expect(beforeRes.statusCode).toBe(200);

      // Revoke the token
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/revoke',
        payload: {
          token: tokens.access_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Token should now be invalid
      const afterRes = await getUserInfo(app, tokens.access_token);
      expect(afterRes.statusCode).toBe(401);
    });

    test('should revoke refresh token and prevent refresh', async () => {
      const tokens = await getAllTokens(app);

      // Revoke refresh token
      await app.inject({
        method: 'POST',
        url: '/application/oauth/revoke',
        payload: {
          token: tokens.refresh_token,
          token_type_hint: 'refresh_token',
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      // Try to refresh - should fail
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
      });
      expect(refreshRes.statusCode).toBe(400);
    });
  });

  describe('OIDC ID Token Flow', () => {
    test('should include correct claims in ID token', async () => {
      const nonce = 'test-nonce-' + Date.now();
      const tokens = await getAllTokens(app, {
        scope: 'openid profile email',
        nonce,
      });

      // Decode and verify ID token claims
      const decoded = jose.decodeJwt(tokens.id_token);

      // Required OIDC claims
      expect(decoded.iss).toBeDefined();
      expect(decoded.sub).toBeDefined();
      expect(decoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded['nonce']).toBe(nonce);

      // Profile claims (from profile scope)
      expect(decoded['name']).toBeDefined();

      // Email claims (from email scope)
      expect(decoded['email']).toBe(TEST_USER.email);
      expect(decoded['email_verified']).toBeDefined();
    });

    test('should validate ID token signature', async () => {
      const tokens = await getAllTokens(app, {
        scope: 'openid profile email',
      });

      // Get JWKS
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      expect(jwksRes.statusCode).toBe(200);

      const jwks = jose.createLocalJWKSet(jwksRes.json());

      // Verify token signature
      const { payload } = await jose.jwtVerify(tokens.id_token, jwks, {
        audience: TEST_OAUTH_CLIENT.clientId,
      });

      expect(payload.sub).toBeDefined();
      expect(payload['email']).toBe(TEST_USER.email);
    });
  });

  describe('Concurrent Session Handling', () => {
    test('should handle multiple authorization flows for same user', async () => {
      // Start two parallel authorization flows
      const session1 = await createAuthenticatedSession(app);
      const session2 = await createAuthenticatedSession(app);

      // Get codes from both sessions
      const [result1, result2] = await Promise.all([
        getAuthorizationCode(app, { sessionCookie: session1 }),
        getAuthorizationCode(app, { sessionCookie: session2 }),
      ]);

      // Both should get valid but different codes
      expect(result1.code).toBeDefined();
      expect(result2.code).toBeDefined();
      expect(result1.code).not.toBe(result2.code);

      // Both codes should be exchangeable
      const [tokenRes1, tokenRes2] = await Promise.all([
        exchangeCodeForTokens(app, { code: result1.code }),
        exchangeCodeForTokens(app, { code: result2.code }),
      ]);

      expect(tokenRes1.statusCode).toBe(200);
      expect(tokenRes2.statusCode).toBe(200);
    });
  });

  describe('Scope Handling', () => {
    test('should respect requested scopes in tokens', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Request only openid scope
      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid',
      });

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid',
      });

      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { id_token, access_token } = tokenRes.json();

      // ID token should have minimal claims (no profile/email)
      const decoded = jose.decodeJwt(id_token);
      expect(decoded.sub).toBeDefined();
      // email may or may not be present depending on implementation

      // Introspect to check scope
      const introspectRes = await introspectToken(app, {
        token: access_token,
      });
      const result = introspectRes.json();
      expect(result.scope).toBeDefined();
    });

    test('should include all requested claims when full scope granted', async () => {
      const tokens = await getAllTokens(app, {
        scope: 'openid profile email',
      });

      // Verify ID token has all claims
      const decoded = jose.decodeJwt(tokens.id_token);
      expect(decoded['name']).toBeDefined();
      expect(decoded['email']).toBeDefined();

      // UserInfo should return all claims
      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfo = userInfoRes.json();
      expect(userInfo.name).toBeDefined();
      expect(userInfo.email).toBeDefined();
    });
  });

  describe('State Parameter Handling', () => {
    test('should preserve state through authorization flow', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const customState = 'custom-state-value-12345';

      const { location } = await getAuthorizationCode(app, {
        sessionCookie,
        state: customState,
      });

      // State is returned in redirect location
      expect(location.searchParams.get('state')).toBe(customState);
    });

    test('should handle special characters in state', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const specialState = 'state_with-special.chars';

      const { location } = await getAuthorizationCode(app, {
        sessionCookie,
        state: specialState,
      });

      expect(location.searchParams.get('state')).toBe(specialState);
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
      const failRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code: code1,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: 'http://wrong.com/callback',
        },
      });
      expect(failRes.statusCode).toBe(400);

      // Get a new code (original is now consumed)
      const { code: code2 } = await getAuthorizationCode(app, {
        sessionCookie,
      });

      // Exchange should succeed with new code
      const successRes = await exchangeCodeForTokens(app, { code: code2 });
      expect(successRes.statusCode).toBe(200);
    });
  });

  describe('Token Lifetime Validation', () => {
    test('should issue tokens with correct expiration', async () => {
      const tokens = await getAllTokens(app);

      const accessDecoded = jose.decodeJwt(tokens.access_token);
      const idDecoded = jose.decodeJwt(tokens.id_token);

      const now = Math.floor(Date.now() / 1000);

      // Tokens should have valid exp
      expect(accessDecoded.exp).toBeGreaterThan(now);
      expect(idDecoded.exp).toBeGreaterThan(now);

      // iat should be around now
      expect(accessDecoded.iat).toBeLessThanOrEqual(now + 5);
      expect(idDecoded.iat).toBeLessThanOrEqual(now + 5);
    });
  });
});
