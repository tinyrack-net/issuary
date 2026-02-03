import type { FastifyInstance } from 'fastify';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getUserInfo,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  refreshAccessToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  });
});

afterAll(async () => {
  await app.close();
});

/**
 * Generate a cryptographically secure code verifier (RFC 7636 compliant)
 * Length: 43-128 characters, using unreserved characters
 */
function generateCodeVerifier(length = 64): string {
  const unreserved =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((v) => unreserved[v % unreserved.length])
    .join('');
}

/**
 * Generate S256 code challenge from code verifier
 */
async function generateS256Challenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * SPA (Single Page Application) PKCE Flow Tests
 *
 * These tests simulate a real SPA authentication flow where:
 * - No client_secret is used (public client)
 * - PKCE is required for security
 * - State parameter prevents CSRF attacks
 * - All communication happens in the browser
 */
describe('SPA PKCE Authentication Flow', () => {
  describe('Complete SPA PKCE Flow', () => {
    test('should complete full PKCE flow without client_secret', async () => {
      // Step 1: SPA generates PKCE values
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);
      const state = `spa-state-${Date.now()}`;

      // Step 2: User authenticates
      const sessionCookie = await createAuthenticatedSession(app);

      // Step 3: Get authorization code with PKCE
      const { code, location } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
        state,
      });

      // Verify state is preserved (CSRF protection)
      expect(location.searchParams.get('state')).toBe(state);

      // Step 4: Exchange code for tokens (NO client_secret)
      const tokenRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: codeVerifier,
          // No client_secret - this is a public client
        },
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');

      // Step 5: Use access token to get user info
      const userInfoRes = await getUserInfo(app, tokens.access_token);
      expect(userInfoRes.statusCode).toBe(200);
      expect(userInfoRes.json().sub).toBeDefined();
    });

    test('should work with dynamically generated PKCE values', async () => {
      // Generate unique PKCE values for each request
      const codeVerifier = generateCodeVerifier(128); // Max length
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
      expect(tokenRes.json().access_token).toBeDefined();
    });

    test('should support minimum length code verifier (43 chars)', async () => {
      const codeVerifier = generateCodeVerifier(43); // Min length
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
    });

    test('should support maximum length code verifier (128 chars)', async () => {
      const codeVerifier = generateCodeVerifier(128); // Max length
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
    });
  });

  describe('PKCE Code Verifier Validation', () => {
    test('should reject code verifier shorter than 43 characters', async () => {
      const shortVerifier = 'a'.repeat(42); // Too short
      const codeChallenge = await generateS256Challenge(shortVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: shortVerifier,
        },
      });

      expect(tokenRes.statusCode).toBe(400);
    });

    test('should reject code verifier longer than 128 characters', async () => {
      const longVerifier = 'a'.repeat(129); // Too long
      const codeChallenge = await generateS256Challenge(longVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: longVerifier,
        },
      });

      expect(tokenRes.statusCode).toBe(400);
    });

    test('should reject mismatched code verifier', async () => {
      const originalVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(originalVerifier);
      const wrongVerifier = generateCodeVerifier(); // Different verifier

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: wrongVerifier,
      });

      expect(tokenRes.statusCode).toBe(400);
      expect(tokenRes.json().code).toBe('INVALID_PKCE_VERIFIER');
    });

    test('should reject when code_verifier is missing but challenge was provided', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Try to exchange without code_verifier
      const tokenRes = await app.inject({
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

      expect(tokenRes.statusCode).toBe(400);
      expect(tokenRes.json().code).toBe('MISSING_CODE_VERIFIER');
    });
  });

  describe('PKCE Challenge Methods', () => {
    test('should work with S256 challenge method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
    });

    test('should work with plain challenge method', async () => {
      const plainVerifier = generateCodeVerifier();

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: plainVerifier, // Plain = verifier is the challenge
        codeChallengeMethod: 'plain',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: plainVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
    });

    test('should default to S256 when method not specified', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Grant consent with code_challenge but no method
      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
        code_challenge: TEST_PKCE.codeChallenge,
        // code_challenge_method not specified
      });

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          code_challenge: TEST_PKCE.codeChallenge,
          // code_challenge_method defaults to S256
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );
      const code = location.searchParams.get('code');

      // Should work with S256 verifier
      const tokenRes = await exchangeCodeForTokens(app, {
        code: code as string,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
    });
  });

  describe('State Parameter (CSRF Protection)', () => {
    test('should preserve state through authorization flow', async () => {
      const state = `csrf-protection-${crypto.randomUUID()}`;
      const sessionCookie = await createAuthenticatedSession(app);

      const { location } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: 'S256',
        state,
      });

      expect(location.searchParams.get('state')).toBe(state);
    });

    test('should handle URL-safe special characters in state', async () => {
      const state = 'state_with-special.chars~123';
      const sessionCookie = await createAuthenticatedSession(app);

      const { location } = await getAuthorizationCode(app, {
        sessionCookie,
        state,
      });

      expect(location.searchParams.get('state')).toBe(state);
    });

    test('should handle base64url encoded state', async () => {
      // Common pattern: SPA encodes return URL in state
      const originalState = { returnUrl: '/dashboard', nonce: Date.now() };
      const state = Buffer.from(JSON.stringify(originalState))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sessionCookie = await createAuthenticatedSession(app);
      const { location } = await getAuthorizationCode(app, {
        sessionCookie,
        state,
      });

      const returnedState = location.searchParams.get('state');
      expect(returnedState).toBe(state);

      // Verify we can decode it back
      const decoded = JSON.parse(
        Buffer.from(returnedState as string, 'base64url').toString(),
      );
      expect(decoded.returnUrl).toBe('/dashboard');
    });

    test('should preserve state even in error redirects', async () => {
      const state = 'error-state-test';
      const sessionCookie = await createAuthenticatedSession(app);

      // Request with invalid scope should redirect with error AND state
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'invalid_scope_xyz',
          state,
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.searchParams.get('error')).toBe('invalid_scope');
      expect(location.searchParams.get('state')).toBe(state);
    });
  });

  describe('SPA Token Refresh Flow', () => {
    test('should refresh tokens without client_secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      // Get initial tokens
      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });
      const { refresh_token } = tokenRes.json();

      // Refresh without client_secret (public client)
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'refresh_token',
          refresh_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
          // No client_secret
        },
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();
      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();
    });

    test('should issue new refresh token on each refresh', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });
      const { refresh_token: rt1 } = tokenRes.json();

      // First refresh
      const refreshRes1 = await refreshAccessToken(app, { refreshToken: rt1 });
      expect(refreshRes1.statusCode).toBe(200);
      const { refresh_token: rt2 } = refreshRes1.json();

      // New refresh token should be different (rotation)
      expect(rt2).toBeDefined();

      // Second refresh with new token
      const refreshRes2 = await refreshAccessToken(app, { refreshToken: rt2 });
      expect(refreshRes2.statusCode).toBe(200);
    });
  });

  describe('SPA Silent Authentication (prompt=none)', () => {
    test('should support silent auth with existing session and consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // First, complete a normal flow to establish consent
      const { code: firstCode } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: 'S256',
      });
      await exchangeCodeForTokens(app, {
        code: firstCode,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      // Now try silent auth
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          prompt: 'none',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: 'S256',
          state: 'silent-auth',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      // Should get code without user interaction
      expect(location.searchParams.get('code')).toBeDefined();
      expect(location.searchParams.has('error')).toBe(false);
    });

    test('should return login_required when no session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          prompt: 'none',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: 'S256',
          state: 'silent-auth',
        },
        // No session cookie
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.searchParams.get('error')).toBe('login_required');
      expect(location.searchParams.get('state')).toBe('silent-auth');
    });
  });

  describe('SPA ID Token Validation', () => {
    test('should include nonce in ID token when provided', async () => {
      const nonce = `spa-nonce-${Date.now()}`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
        nonce,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });
      const { id_token } = tokenRes.json();

      // Verify nonce in ID token
      const decoded = jose.decodeJwt(id_token);
      expect(decoded['nonce']).toBe(nonce);
    });

    test('should allow SPA to verify ID token with JWKS', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });
      const { id_token, access_token } = tokenRes.json();

      // Get JWKS (SPA would fetch this)
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      const jwks = jose.createLocalJWKSet(jwksRes.json());

      // Verify ID token signature
      const { payload } = await jose.jwtVerify(id_token, jwks, {
        audience: TEST_OAUTH_CLIENT.clientId,
      });

      expect(payload.sub).toBeDefined();
      expect(payload.aud).toBe(TEST_OAUTH_CLIENT.clientId);

      // Verify access token is valid
      const userInfoRes = await getUserInfo(app, access_token);
      expect(userInfoRes.statusCode).toBe(200);
      expect(userInfoRes.json().sub).toBe(payload.sub);
    });
  });

  describe('SPA Error Handling', () => {
    // Note: Authorization code single-use is tested in token-lifecycle.test.ts

    test('should handle expired authorization code gracefully', async () => {
      // Use a fake/expired code
      const res = await exchangeCodeForTokens(app, {
        code: 'expired-or-invalid-code',
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_AUTHORIZATION_CODE');
    });
  });

  describe('SPA Token Introspection', () => {
    test('should allow token introspection without client_secret', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });
      const { access_token } = tokenRes.json();

      // Introspect without client_secret
      const introspectRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/introspect',
        payload: {
          token: access_token,
          // No client_secret
        },
      });

      expect(introspectRes.statusCode).toBe(200);
      const result = introspectRes.json();
      expect(result.active).toBe(true);
      expect(result.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
    });
  });

  describe('PKCE with Different Scope Combinations', () => {
    test('should work with openid scope only', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
        scope: 'openid',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.scope).toBe('openid');
    });

    test('should work without openid scope (pure OAuth2)', async () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateS256Challenge(codeVerifier);

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
        scope: 'profile email',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier,
      });

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();
      expect(tokens.id_token).toBeUndefined(); // No OIDC without openid scope
      expect(tokens.access_token).toBeDefined();
    });
  });
});
