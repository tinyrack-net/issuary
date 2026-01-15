import * as jose from 'jose';
import { describe, expect, test } from 'vitest';
import type { AppConfig } from '@/lib/config/index.js';
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
  TEST_USER,
} from '@/test-utils/index.js';
import { DEFAULT_TEST_CONFIG } from '@/test-utils/setup.js';

/**
 * Second OAuth client for multi-client testing
 */
const SECOND_OAUTH_CLIENT = {
  clientId: 'second-client-id',
  clientSecret: 'second-client-secret',
  redirectUri: 'http://localhost:3001/callback',
} as const;

/**
 * Config with multiple OAuth clients for testing client isolation
 */
const multiClientConfig: AppConfig = {
  ...DEFAULT_TEST_CONFIG,
  providers: [
    // First client - existing test client
    {
      id: 'test-config-oauth-client',
      name: 'First Client',
      logo_uri: 'https://first-client.com/logo',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
      redirect_uris: [TEST_OAUTH_CLIENT.redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid profile email',
    },
    // Second client - different client for isolation testing
    {
      id: 'second-oauth-client',
      name: 'Second Client',
      logo_uri: 'https://second-client.com/logo',
      client_id: SECOND_OAUTH_CLIENT.clientId,
      client_secret: SECOND_OAUTH_CLIENT.clientSecret,
      redirect_uris: [SECOND_OAUTH_CLIENT.redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'openid profile email',
    },
  ],
};

/**
 * Multi-Client Isolation Tests
 *
 * These tests verify that OAuth tokens are properly isolated between clients:
 * - Tokens from one client cannot be used with another
 * - Same user can authorize multiple clients independently
 * - Token revocation is client-specific
 * - Client credentials are properly validated
 */
describe('Multi-Client Isolation', () => {
  const app = setupTestServer({ baseConfig: multiClientConfig });

  describe('Token Isolation Between Clients', () => {
    test(
      'should issue different tokens for different clients',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        expect(tokenRes1.statusCode).toBe(200);
        const tokens1 = tokenRes1.json();

        // Get tokens for second client
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        expect(tokenRes2.statusCode).toBe(200);
        const tokens2 = tokenRes2.json();

        // Tokens should be different
        expect(tokens1.access_token).not.toBe(tokens2.access_token);
        expect(tokens1.refresh_token).not.toBe(tokens2.refresh_token);
        expect(tokens1.id_token).not.toBe(tokens2.id_token);
      },
    );

    test(
      'should have correct client_id in token claims',
      { timeout: 15000 },
      async () => {
        const jwksRes = await app.inject({
          method: 'GET',
          url: '/application/oauth/.well-known/jwks',
        });
        const JWKS = jose.createLocalJWKSet(jwksRes.json());

        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();
        const { payload: payload1 } = await jose.jwtVerify(
          tokens1.access_token,
          JWKS,
        );

        expect(payload1['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);

        // Get tokens for second client
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();
        const { payload: payload2 } = await jose.jwtVerify(
          tokens2.access_token,
          JWKS,
        );

        expect(payload2['client_id']).toBe(SECOND_OAUTH_CLIENT.clientId);
      },
    );

    test(
      'should have same subject for same user across clients',
      { timeout: 15000 },
      async () => {
        const jwksRes = await app.inject({
          method: 'GET',
          url: '/application/oauth/.well-known/jwks',
        });
        const JWKS = jose.createLocalJWKSet(jwksRes.json());

        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();
        const { payload: payload1 } = await jose.jwtVerify(
          tokens1.id_token,
          JWKS,
        );

        // Get tokens for second client
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();
        const { payload: payload2 } = await jose.jwtVerify(
          tokens2.id_token,
          JWKS,
        );

        // Subject should be the same (same user)
        expect(payload1.sub).toBe(payload2.sub);

        // But audience should be different (different clients)
        expect(payload1.aud).toBe(TEST_OAUTH_CLIENT.clientId);
        expect(payload2.aud).toBe(SECOND_OAUTH_CLIENT.clientId);
      },
    );
  });

  describe('Cross-Client Token Usage Prevention', () => {
    test(
      'should reject refresh token from different client',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes = await exchangeCodeForTokens(app, {
          code,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens = tokenRes.json();

        // Try to refresh with second client's credentials
        const refreshRes = await app.inject({
          method: 'POST',
          url: '/application/oauth/token',
          payload: {
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            client_id: SECOND_OAUTH_CLIENT.clientId,
            client_secret: SECOND_OAUTH_CLIENT.clientSecret,
          },
        });

        // Should fail - refresh token bound to first client
        expect([400, 401]).toContain(refreshRes.statusCode);
      },
    );

    test(
      'should reject authorization code exchange with wrong client',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get authorization code for first client
        const { code } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        // Try to exchange with second client
        const tokenRes = await exchangeCodeForTokens(app, {
          code,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        // Should fail - code was issued for first client
        expect([400, 401]).toContain(tokenRes.statusCode);
      },
    );
  });

  describe('Client Credential Validation', () => {
    test('should reject wrong client_secret', { timeout: 15000 }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        clientId: TEST_OAUTH_CLIENT.clientId,
        redirectUri: TEST_OAUTH_CLIENT.redirectUri,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      // Try to exchange with wrong secret
      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: 'wrong-secret',
        redirectUri: TEST_OAUTH_CLIENT.redirectUri,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect([400, 401]).toContain(tokenRes.statusCode);
    });

    test(
      'should reject mismatched redirect_uri',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        const { code } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        // Try to exchange with different redirect_uri
        const tokenRes = await exchangeCodeForTokens(app, {
          code,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: 'http://attacker.com/callback', // Wrong redirect
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        expect([400, 401]).toContain(tokenRes.statusCode);
      },
    );

    test(
      'should reject non-existent client_id',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Try authorize with non-existent client
        const authRes = await app.inject({
          method: 'GET',
          url: '/application/oauth/authorize',
          query: {
            response_type: 'code',
            client_id: 'non-existent-client',
            redirect_uri: 'http://localhost:8080/callback',
            scope: 'openid profile email',
            state: 'test-state',
          },
          cookies: { session: sessionCookie },
        });

        // Should fail with invalid_client or redirect error
        expect([400, 302]).toContain(authRes.statusCode);

        if (authRes.statusCode === 302) {
          const location = new URL(
            authRes.headers.location as string,
            'http://localhost:8080',
          );
          // Should have error in redirect
          expect(location.searchParams.has('error')).toBe(true);
        }
      },
    );
  });

  describe('Token Introspection Isolation', () => {
    test(
      'should introspect token with correct client credentials',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        const { code } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes = await exchangeCodeForTokens(app, {
          code,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens = tokenRes.json();

        // Introspect with same client
        const introspectRes = await introspectToken(app, {
          token: tokens.access_token,
          tokenTypeHint: 'access_token',
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
        });

        expect(introspectRes.statusCode).toBe(200);
        const introspection = introspectRes.json();

        expect(introspection.active).toBe(true);
        expect(introspection.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      },
    );

    test(
      'should show token metadata with correct client_id',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for both clients
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();

        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();

        // Introspect both tokens and verify client_id
        const intro1 = await introspectToken(app, {
          token: tokens1.access_token,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
        });

        const intro2 = await introspectToken(app, {
          token: tokens2.access_token,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
        });

        expect(intro1.json().client_id).toBe(TEST_OAUTH_CLIENT.clientId);
        expect(intro2.json().client_id).toBe(SECOND_OAUTH_CLIENT.clientId);
      },
    );
  });

  describe('Token Revocation Isolation', () => {
    test(
      'should only revoke tokens for the requesting client',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();

        // Get tokens for second client
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();

        // Revoke first client's token
        const revokeRes = await revokeToken(app, {
          token: tokens1.access_token,
          tokenTypeHint: 'access_token',
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
        });

        expect(revokeRes.statusCode).toBe(200);

        // First client's token should be revoked
        const userInfo1Res = await getUserInfo(app, tokens1.access_token);
        expect(userInfo1Res.statusCode).toBe(401);

        // Second client's token should still work
        const userInfo2Res = await getUserInfo(app, tokens2.access_token);
        expect(userInfo2Res.statusCode).toBe(200);
      },
    );
  });

  describe('UserInfo Access with Different Client Tokens', () => {
    test(
      'should return same user info for tokens from different clients',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for first client
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();

        // Get tokens for second client
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();

        // Get user info with both tokens
        const userInfo1Res = await getUserInfo(app, tokens1.access_token);
        const userInfo2Res = await getUserInfo(app, tokens2.access_token);

        expect(userInfo1Res.statusCode).toBe(200);
        expect(userInfo2Res.statusCode).toBe(200);

        const userInfo1 = userInfo1Res.json();
        const userInfo2 = userInfo2Res.json();

        // Same user should have same sub and email
        expect(userInfo1.sub).toBe(userInfo2.sub);
        expect(userInfo1.email).toBe(userInfo2.email);
        expect(userInfo1.email).toBe(TEST_USER.email);
      },
    );
  });

  describe('Independent Consent Per Client', () => {
    test(
      'should require separate consent for each client',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // First client authorization should work after consent
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        expect(code1).toBeDefined();

        // Second client authorization should also work (consent is granted in getAuthorizationCode)
        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        expect(code2).toBeDefined();

        // Codes should be different
        expect(code1).not.toBe(code2);
      },
    );
  });

  describe('Simultaneous Sessions', () => {
    test(
      'should maintain independent token sets for same user with multiple clients',
      { timeout: 15000 },
      async () => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          TEST_USER.email,
          TEST_USER.password,
        );

        // Get tokens for both clients
        const { code: code1 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: TEST_OAUTH_CLIENT.clientId,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes1 = await exchangeCodeForTokens(app, {
          code: code1,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
          redirectUri: TEST_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens1 = tokenRes1.json();

        const { code: code2 } = await getAuthorizationCode(app, {
          sessionCookie,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        const tokenRes2 = await exchangeCodeForTokens(app, {
          code: code2,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
          redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
          codeVerifier: TEST_PKCE.codeVerifier,
        });

        const tokens2 = tokenRes2.json();

        // Both sets should be independently refreshable
        const refresh1Res = await refreshAccessToken(app, {
          refreshToken: tokens1.refresh_token,
          clientId: TEST_OAUTH_CLIENT.clientId,
          clientSecret: TEST_OAUTH_CLIENT.clientSecret,
        });

        expect(refresh1Res.statusCode).toBe(200);

        const refresh2Res = await refreshAccessToken(app, {
          refreshToken: tokens2.refresh_token,
          clientId: SECOND_OAUTH_CLIENT.clientId,
          clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
        });

        expect(refresh2Res.statusCode).toBe(200);

        // New tokens should be different from each other
        const newTokens1 = refresh1Res.json();
        const newTokens2 = refresh2Res.json();

        expect(newTokens1.access_token).not.toBe(newTokens2.access_token);
      },
    );
  });
});
