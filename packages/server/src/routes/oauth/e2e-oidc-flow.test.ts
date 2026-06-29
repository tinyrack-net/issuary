import { createHash } from 'node:crypto';
import { testClient } from 'hono/testing';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import { encrypt } from '../../lib/crypto.ts';
import {
  assertDefined,
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens,
  extractCookie,
  getAuthorizationCode,
  getUserInfo,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  parseJwks,
  refreshAccessToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

const REFRESHABLE_SCOPE = 'openid profile email offline_access';

const E2E_REFRESHABLE_CLIENT = {
  clientId: 'e2e-refreshable-client',
  clientSecret: 'e2e-refreshable-secret',
  redirectUri: 'http://localhost:8080/e2e-refreshable-callback',
};

const E2E_REFRESHABLE_CLIENT_CONFIG = {
  id: 'e2e-refreshable-client-config',
  name: 'E2E Refreshable Client',
  client_id: E2E_REFRESHABLE_CLIENT.clientId,
  client_secret: E2E_REFRESHABLE_CLIENT.clientSecret,
  redirect_uris: [E2E_REFRESHABLE_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email offline_access id_token',
};

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG, E2E_REFRESHABLE_CLIENT_CONFIG],
  }));
});

afterAll(async () => {
  await cleanup();
});

async function issueRefreshableTokens() {
  const sessionCookie = await createAuthenticatedSession(app);
  const { code } = await getAuthorizationCode(app, {
    clientId: E2E_REFRESHABLE_CLIENT.clientId,
    redirectUri: E2E_REFRESHABLE_CLIENT.redirectUri,
    sessionCookie,
    scope: REFRESHABLE_SCOPE,
    codeChallenge: TEST_PKCE.codeChallenge,
    codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
  });

  const tokenRes = await exchangeCodeForTokens(app, {
    code,
    clientId: E2E_REFRESHABLE_CLIENT.clientId,
    clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
    redirectUri: E2E_REFRESHABLE_CLIENT.redirectUri,
    codeVerifier: TEST_PKCE.codeVerifier,
  });

  return assertJsonBody(tokenRes, 200);
}

async function createSessionCookieWithAuthTime(
  authenticatedAt: number,
): Promise<string> {
  return encrypt(
    JSON.stringify({
      user: {
        sub: TEST_USER_CONFIG.sub,
        authenticated_at: authenticatedAt,
      },
    }),
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
}

function applySessionSetCookie(
  currentSessionCookie: string | undefined,
  setCookie: string | null,
): string | undefined {
  if (!setCookie) {
    return currentSessionCookie;
  }

  const sessionSetCookie = setCookie
    .split(/,(?=\s*\w+=)/)
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('session='));
  if (!sessionSetCookie) {
    return currentSessionCookie;
  }

  const value = sessionSetCookie.match(/^session=([^;]*)/)?.[1] ?? '';
  return value === '' ? undefined : value;
}

/**
 * End-to-End OIDC Flow Tests
 *
 * These tests verify the complete OIDC flow chain:
 * 1. Discovery (.well-known/openid-configuration)
 * 2. JWKS retrieval (.well-known/jwks)
 * 3. Authorization (authorization code grant)
 * 4. Token exchange
 * 5. Token signature verification using JWKS
 * 6. UserInfo retrieval
 *
 * This simulates a real OIDC client implementation that follows
 * the discovery-first approach as recommended by the spec.
 */
describe('End-to-End OIDC Flow', () => {
  describe('Phase 10 Protocol Regression Suite', () => {
    test('should complete discovery-driven S256 OIDC flow with nonce and at_hash verification', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();
      const config = await assertJsonBody(configRes, 200);

      const jwksPath = new URL(config.jwks_uri).pathname;
      const jwksRes = await app.request(jwksPath);
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const sessionCookie = await createAuthenticatedSession(app);
      const nonce = crypto.randomUUID();
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        nonce,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      const tokens = await assertJsonBody(tokenRes, 200);

      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
        {
          issuer: config.issuer,
          audience: TEST_OAUTH_CLIENT.clientId,
        },
      );

      const hash = createHash('sha256').update(tokens.access_token).digest();
      const expectedAtHash = hash
        .subarray(0, hash.length / 2)
        .toString('base64url');

      expect(payload['nonce']).toBe(nonce);
      expect(payload['at_hash']).toBe(expectedAtHash);

      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfo = await assertJsonBody(userInfoRes, 200);
      expect(userInfo.sub).toBe(payload.sub);
    });

    test('should issue refresh tokens only for offline_access on a refresh-enabled client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      const tokens = await assertJsonBody(tokenRes, 200);
      expect(tokens.refresh_token).toBeUndefined();

      const refreshableTokens = await issueRefreshableTokens();
      expect(refreshableTokens.refresh_token).toBeDefined();

      const refreshRes = await refreshAccessToken(app, {
        refreshToken: refreshableTokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });
      const refreshedTokens = await assertJsonBody(refreshRes, 200);
      expect(refreshedTokens.access_token).toBeDefined();
      expect(refreshedTokens.refresh_token).toBeDefined();
    });

    test('should invalidate the refresh token family after replay over HTTP', async () => {
      const firstTokens = await issueRefreshableTokens();

      const rotatedRes = await refreshAccessToken(app, {
        refreshToken: firstTokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });
      const rotatedTokens = await assertJsonBody(rotatedRes, 200);

      const replayRes = await refreshAccessToken(app, {
        refreshToken: firstTokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });
      const replayJson = await assertJsonBody(replayRes, 400);
      expect(replayJson.code).toBe('INVALID_REFRESH_TOKEN');

      const newestRefreshRes = await refreshAccessToken(app, {
        refreshToken: rotatedTokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });
      const newestRefreshJson = await assertJsonBody(newestRefreshRes, 400);
      expect(newestRefreshJson.code).toBe('INVALID_REFRESH_TOKEN');

      const userInfoRes = await getUserInfo(app, rotatedTokens.access_token);
      expect(userInfoRes.status).toBe(401);
    });

    test('should return an OIDC login_required redirect for prompt=none stale sessions', async () => {
      const authenticatedAt = Math.floor(Date.now() / 1000) - 600;
      const sessionCookie =
        await createSessionCookieWithAuthTime(authenticatedAt);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state: 'phase-10-stale-session',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const client = testClient(app);
      const res = await client.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid profile email',
            state: 'phase-10-stale-session',
            code_challenge: TEST_PKCE.codeChallenge,
            code_challenge_method: TEST_PKCE.codeChallengeMethod,
            prompt: 'none',
            max_age: '300',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const locationHeader = res.headers.get('location');
      if (!locationHeader) {
        throw new Error('Expected prompt=none response to include Location');
      }
      const location = new URL(locationHeader, 'http://localhost:8080');
      expect(location.pathname).toBe('/callback');
      expect(location.searchParams.get('error')).toBe('login_required');
      expect(location.searchParams.get('state')).toBe('phase-10-stale-session');
      expect(location.searchParams.has('code')).toBe(false);
    });
  });

  describe('Complete Discovery-Based Flow', () => {
    test('should complete full OIDC flow with signature verification', async () => {
      // Step 1: Discover OIDC configuration
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(configRes.status).toBe(200);
      const config = await configRes.json();

      expect(config.issuer).toBeDefined();
      expect(config.authorization_endpoint).toBeDefined();
      expect(config.token_endpoint).toBeDefined();
      expect(config.jwks_uri).toBeDefined();
      expect(config.userinfo_endpoint).toBeDefined();

      // Step 2: Fetch JWKS for token verification
      const jwksRes = await client.oauth['.well-known'].jwks.$get();

      expect(jwksRes.status).toBe(200);
      const jwks = await parseJwks(jwksRes);

      expect(jwks.keys).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThanOrEqual(1);

      // Create JWKS for jose verification
      const JWKS = jose.createLocalJWKSet(jwks);

      // Step 3: Get authorization code
      const sessionCookie = await createAuthenticatedSession(app);
      const nonce = crypto.randomUUID();

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        nonce,
      });

      // Step 4: Exchange code for tokens
      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      expect(tokenRes.status).toBe(200);
      const tokens = await tokenRes.json();

      expect(tokens.access_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.refresh_token).toBeUndefined();
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBeDefined();

      // Step 5: Verify ID token signature using JWKS
      const { payload: idTokenPayload, protectedHeader: idTokenHeader } =
        await jose.jwtVerify(assertDefined(tokens.id_token), JWKS, {
          issuer: config.issuer,
          audience: TEST_OAUTH_CLIENT.clientId,
        });

      // Verify ID token header
      expect(idTokenHeader.alg).toBe('RS256');
      expect(idTokenHeader.typ).toBe('JWT');
      expect(idTokenHeader.kid).toBeDefined();

      // Verify ID token required claims
      expect(idTokenPayload.iss).toBe(config.issuer);
      expect(idTokenPayload.sub).toBeDefined();
      expect(idTokenPayload.aud).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(idTokenPayload.exp).toBeDefined();
      expect(idTokenPayload.iat).toBeDefined();
      expect(idTokenPayload['nonce']).toBe(nonce);

      // Step 6: Verify access token signature using JWKS
      const {
        payload: accessTokenPayload,
        protectedHeader: accessTokenHeader,
      } = await jose.jwtVerify(tokens.access_token, JWKS, {
        issuer: config.issuer,
      });

      expect(accessTokenHeader.alg).toBe('RS256');
      expect(accessTokenHeader.kid).toBeDefined();
      expect(accessTokenPayload.iss).toBe(config.issuer);
      expect(accessTokenPayload.sub).toBeDefined();

      // Step 7: Use access token to get user info
      const userInfoRes = await getUserInfo(app, tokens.access_token);

      expect(userInfoRes.status).toBe(200);
      const userInfo = await userInfoRes.json();

      expect(userInfo.sub).toBe(idTokenPayload.sub);
      expect(userInfo.email).toBe(TEST_USER.email);
    });

    test('should have consistent kid between JWKS and tokens', async () => {
      // Get JWKS
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();

      const jwks = await jwksRes.json();
      const availableKids = jwks.keys.map((key: { kid: string }) => key.kid);

      // Get tokens
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

      const tokens = await tokenRes.json();

      // Decode tokens to check kid
      const idTokenHeader = jose.decodeProtectedHeader(
        assertDefined(tokens.id_token),
      );
      const accessTokenHeader = jose.decodeProtectedHeader(tokens.access_token);

      // Verify kid exists in JWKS
      expect(availableKids).toContain(idTokenHeader.kid);
      expect(availableKids).toContain(accessTokenHeader.kid);
    });
  });

  describe('ID Token Verification', () => {
    test('should verify ID token has required OIDC claims', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const sessionCookie = await createAuthenticatedSession(app);
      const nonce = crypto.randomUUID();

      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        nonce,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
      );

      // Required claims per OIDC Core 1.0 Section 2
      expect(payload.iss).toBeDefined();
      expect(payload.sub).toBeDefined();
      expect(payload.aud).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();

      // Nonce claim when provided in request
      expect(payload['nonce']).toBe(nonce);

      // Verify timestamps are reasonable
      const now = Math.floor(Date.now() / 1000);
      expect(payload.iat).toBeLessThanOrEqual(now);
      if (typeof payload.exp === 'number') {
        expect(payload.exp).toBeGreaterThan(now);
      }
    });

    test('should include at_hash claim when access token is issued', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
      );

      // OIDC Core 1.0 §3.1.3.6: at_hash should be present
      expect(payload['at_hash']).toBeDefined();
      expect(typeof payload['at_hash']).toBe('string');
    });

    test('should verify at_hash matches access token', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
      );

      // Compute at_hash manually to verify
      // OIDC Core 1.0 §3.1.3.6: at_hash = base64url(left_half(sha256(access_token)))
      const hash = createHash('sha256').update(tokens.access_token).digest();
      const leftHalf = hash.subarray(0, hash.length / 2);
      const expectedAtHash = leftHalf.toString('base64url');

      expect(payload['at_hash']).toBe(expectedAtHash);
    });

    test('should include user claims based on requested scopes', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
      );

      // Profile scope claims
      // (may or may not be in ID token - implementation specific)

      // Email scope claims (often in ID token when email scope requested)
      expect(payload['email']).toBe(TEST_USER.email);
      expect(payload['email_verified']).toBeDefined();
    });
  });

  describe('Access Token Verification', () => {
    test('should verify access token has required claims', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(tokens.access_token, JWKS);

      // Standard JWT claims
      expect(payload.iss).toBeDefined();
      expect(payload.sub).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();

      // OAuth-specific claims
      expect(payload['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(payload['scope']).toBeDefined();
    });

    test('should have reasonable expiration time', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();
      const { payload } = await jose.jwtVerify(tokens.access_token, JWKS);

      const now = Math.floor(Date.now() / 1000);

      // Token should not be expired
      if (typeof payload.exp === 'number' && typeof payload.iat === 'number') {
        expect(payload.exp).toBeGreaterThan(now);

        // Token lifetime should be reasonable (e.g., 1 hour to 24 hours)
        const lifetime = payload.exp - payload.iat;
        expect(lifetime).toBeGreaterThanOrEqual(300); // At least 5 minutes
        expect(lifetime).toBeLessThanOrEqual(86400); // At most 24 hours
      }
    });
  });

  describe('Refresh Token Flow with Verification', () => {
    test('should issue new valid tokens on refresh', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const tokens = await issueRefreshableTokens();

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });

      const newTokens = await assertJsonBody(refreshRes);

      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();

      // Verify new access token is valid
      const { payload: newAccessPayload } = await jose.jwtVerify(
        newTokens.access_token,
        JWKS,
      );

      expect(newAccessPayload.iss).toBeDefined();
      expect(newAccessPayload.sub).toBeDefined();
    });

    test('should maintain same subject across token refresh', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const tokens = await issueRefreshableTokens();
      const { payload: originalPayload } = await jose.jwtVerify(
        tokens.access_token,
        JWKS,
      );

      // Refresh the token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
        clientId: E2E_REFRESHABLE_CLIENT.clientId,
        clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
      });

      const newTokens = await assertJsonBody(refreshRes);
      const { payload: newPayload } = await jose.jwtVerify(
        newTokens.access_token,
        JWKS,
      );

      // Subject should be the same
      expect(newPayload.sub).toBe(originalPayload.sub);
    });
  });

  describe('UserInfo Endpoint Consistency', () => {
    test('should return consistent claims between ID token and UserInfo', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = await tokenRes.json();
      const { payload: idTokenClaims } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
      );

      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfoClaims = await userInfoRes.json();

      // Sub claim MUST match per OIDC Core 1.0 Section 5.3.4
      expect(userInfoClaims.sub).toBe(idTokenClaims.sub);

      // Email claims should be consistent if present in both
      if (idTokenClaims['email'] && userInfoClaims.email) {
        expect(userInfoClaims.email).toBe(idTokenClaims['email']);
      }

      if (
        idTokenClaims['email_verified'] !== undefined &&
        userInfoClaims.email_verified !== undefined
      ) {
        expect(userInfoClaims.email_verified).toBe(
          idTokenClaims['email_verified'],
        );
      }
    });

    test('should return claims based on access token scope', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid email', // Only openid and email, no profile
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });

      const tokens = await tokenRes.json();
      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfo = await userInfoRes.json();

      // Should have sub (always present)
      expect(userInfo.sub).toBeDefined();

      // Should have email claims (email scope)
      expect(userInfo.email).toBeDefined();
    });
  });

  describe('JWKS Key Properties', () => {
    test('should have RSA key with proper structure', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();

      const jwks = await assertJsonBody(jwksRes);

      for (const key of jwks.keys) {
        // RFC 7517 JWK structure
        expect(key.kty).toBe('RSA');
        expect(key.use).toBe('sig');
        expect(key.alg).toBe('RS256');
        expect(key.kid).toBeDefined();

        // RSA public key components
        expect(key.n).toBeDefined(); // modulus
        expect(key.e).toBeDefined(); // exponent

        // Should NOT contain private key components
        expect('d' in key).toBe(false); // private exponent
        expect('p' in key).toBe(false); // first prime factor
        expect('q' in key).toBe(false); // second prime factor
        expect('dp' in key).toBe(false); // first factor CRT exponent
        expect('dq' in key).toBe(false); // second factor CRT exponent
        expect('qi' in key).toBe(false); // first CRT coefficient
      }
    });

    test('should be able to import JWKS key and verify token', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();

      const jwks = await assertJsonBody(jwksRes);

      // Import the first key
      const key = jwks.keys[0];
      expect(key).toBeDefined();
      if (!key) return;
      const publicKey = await jose.importJWK(key as jose.JWK, 'RS256');

      // Get a token
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

      const tokens = await tokenRes.json();

      // Verify using the imported key
      const tokenHeader = jose.decodeProtectedHeader(
        assertDefined(tokens.id_token),
      );

      // Only verify if the token was signed with this key
      if (tokenHeader.kid === key.kid) {
        const { payload } = await jose.jwtVerify(
          assertDefined(tokens.id_token),
          publicKey,
        );
        expect(payload.sub).toBeDefined();
      }
    });
  });

  describe('OpenID Configuration Compliance', () => {
    test('should list all advertised endpoints as working', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();

      const config = await assertJsonBody(configRes);

      // Test JWKS URI
      const jwksRes = await client.oauth['.well-known'].jwks.$get();
      expect(jwksRes.status).toBe(200);

      // Authorization endpoint requires params, just verify path exists
      expect(config.authorization_endpoint).toBeDefined();
      const authUrl = new URL(config.authorization_endpoint ?? '');
      expect(authUrl.pathname).toContain('/authorize');

      // Token endpoint requires params
      expect(config.token_endpoint).toBeDefined();
      const tokenUrl = new URL(config.token_endpoint ?? '');
      expect(tokenUrl.pathname).toContain('/token');

      // UserInfo endpoint requires auth
      expect(config.userinfo_endpoint).toBeDefined();
      const userinfoUrl = new URL(config.userinfo_endpoint ?? '');
      expect(userinfoUrl.pathname).toContain('/userinfo');
    });

    test('should support advertised grant types', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();

      const config = await assertJsonBody(configRes);

      // Test authorization_code grant
      expect(config.grant_types_supported).toBeDefined();
      if (config.grant_types_supported?.includes('authorization_code')) {
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

        expect(tokenRes.status).toBe(200);
      }

      // Test refresh_token grant
      if (config.grant_types_supported?.includes('refresh_token')) {
        const tokens = await issueRefreshableTokens();
        const refreshRes = await refreshAccessToken(app, {
          refreshToken: tokens.refresh_token,
          clientId: E2E_REFRESHABLE_CLIENT.clientId,
          clientSecret: E2E_REFRESHABLE_CLIENT.clientSecret,
        });

        expect(refreshRes.status).toBe(200);
      }
    });

    test('should support advertised response types', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();

      const config = await configRes.json();

      // Test 'code' response type
      if (config.response_types_supported.includes('code')) {
        const sessionCookie = await createAuthenticatedSession(app);
        const { code } = await getAuthorizationCode(app, {
          sessionCookie,
          codeChallenge: TEST_PKCE.codeChallenge,
          codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
        });

        expect(code).toBeDefined();
      }
    });

    test('should support advertised scopes', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();

      const config = await assertJsonBody(configRes);

      // Verify openid scope is supported and works
      expect(config.scopes_supported).toBeDefined();
      expect(config.scopes_supported).toContain('openid');

      // Filter to scopes the test client is allowed to use
      const clientScopes = new Set<string>(TEST_OAUTH_CLIENT.allowedScopes);
      const requestScopes = (config.scopes_supported ?? []).filter(
        (s: string) => clientScopes.has(s),
      );

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: requestScopes.join(' '),
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      expect(code).toBeDefined();
    });
  });

  describe('Error Scenarios with Valid JWKS', () => {
    test('should reject token with tampered signature', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();

      // Tamper with the token signature (modify last few chars)
      const parts = tokens.access_token.split('.');
      const tamperedSignature = `${parts[2]?.slice(0, -4)}XXXX`;
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      // Verification should fail
      await expect(jose.jwtVerify(tamperedToken, JWKS)).rejects.toThrow();
    });

    test('should reject token with wrong issuer', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();

      // Verify with wrong issuer should fail
      await expect(
        jose.jwtVerify(assertDefined(tokens.id_token), JWKS, {
          issuer: 'https://wrong-issuer.example.com',
        }),
      ).rejects.toThrow();
    });

    test('should reject token with wrong audience', async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));

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

      const tokens = await tokenRes.json();

      // Verify with wrong audience should fail
      await expect(
        jose.jwtVerify(assertDefined(tokens.id_token), JWKS, {
          audience: 'wrong-client-id',
        }),
      ).rejects.toThrow();
    });
  });
});

describe('End-to-End OIDC Account Selection Flow', () => {
  const ACCOUNT_A = TEST_USER_CONFIG;
  const ACCOUNT_B = {
    sub: 'e2e-selected-account-user',
    email: 'selected-account@example.com',
    password: 'changemelater',
    role: 'user' as const,
  };
  const ACCOUNT_C = {
    sub: 'e2e-max-cap-active-user',
    email: 'max-cap-active@example.com',
    password: 'changemelater',
    role: 'user' as const,
  };

  let accountSelectionApp: AppType;
  let accountSelectionCleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ app: accountSelectionApp, cleanup: accountSelectionCleanup } =
      await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        auth: {
          account_selection: {
            enabled: true,
            mode: 'smart',
          },
        },
        users: [ACCOUNT_A, ACCOUNT_B],
        clients: [TEST_OAUTH_CLIENT_CONFIG],
      }));
  });

  afterAll(async () => {
    await accountSelectionCleanup();
  });

  async function createMultiAccountSession(activeSub: string) {
    const authenticatedAt = Math.floor(Date.now() / 1000) - 5;
    return encrypt(
      JSON.stringify({
        user: {
          sub: activeSub,
          authenticated_at: authenticatedAt,
        },
        accounts: [
          {
            sub: ACCOUNT_A.sub,
            authenticated_at: authenticatedAt - 10,
            last_used_at: authenticatedAt - 10,
          },
          {
            sub: ACCOUNT_B.sub,
            authenticated_at: authenticatedAt,
            last_used_at: authenticatedAt,
          },
        ],
      }),
      MINIMAL_TEST_CONFIG.security.session_secret,
    );
  }

  test('preserves chooser continuation params through consent before issuing the selected-account code', async () => {
    const client = testClient(accountSelectionApp);
    const sessionCookie = await createMultiAccountSession(ACCOUNT_B.sub);

    const authorizeQuery = {
      response_type: 'code',
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      scope: 'openid profile email',
      state: 'account-selection-consent-state',
      nonce: 'account-selection-consent-nonce',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      prompt: 'select_account consent',
      max_age: '3600',
      display: 'popup',
      response_mode: 'fragment',
      login_hint: ACCOUNT_B.email,
      ui_locales: 'ko en',
      id_token_hint: 'header.payload.signature',
      acr_values: 'urn:mace:incommon:iap:silver',
    };

    const chooserRes = await client.oauth.authorize.$get(
      { query: authorizeQuery },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(chooserRes.status).toBe(302);
    const chooserLocation = new URL(chooserRes.headers.get('location') ?? '');
    expect(chooserLocation.pathname).toBe('/account/select');
    const accountSelectionState = chooserLocation.searchParams.get(
      'account_selection_state',
    );
    expect(accountSelectionState).not.toBeNull();
    const chooserSessionCookie = extractCookie(chooserRes, 'session');

    const consentRes = await client.oauth.authorize.$get(
      {
        query: {
          ...authorizeQuery,
          account_selected: '1',
          account_selection_state: accountSelectionState ?? '',
        },
      },
      { headers: { Cookie: `session=${chooserSessionCookie}` } },
    );
    expect(consentRes.status).toBe(302);
    const consentLocation = new URL(consentRes.headers.get('location') ?? '');
    expect(consentLocation.pathname).toBe('/consent');
    expect(consentLocation.searchParams.get('prompt')).toBe(
      'select_account consent',
    );
    expect(consentLocation.searchParams.get('response_mode')).toBe('fragment');
    expect(consentLocation.searchParams.get('account_selection_state')).toBe(
      accountSelectionState,
    );

    const consentPostRes = await client.api.consent.$post(
      {
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'account-selection-consent-state',
          nonce: 'account-selection-consent-nonce',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'select_account',
          max_age: 3600,
          display: 'popup',
          response_mode: 'fragment',
          login_hint: ACCOUNT_B.email,
          ui_locales: 'ko en',
          id_token_hint: 'header.payload.signature',
          acr_values: 'urn:mace:incommon:iap:silver',
          account_selected: '1',
          account_selection_state: accountSelectionState ?? '',
          decision: 'allow',
        },
      },
      { headers: { Cookie: `session=${chooserSessionCookie}` } },
    );
    const consentBody = await assertJsonBody(consentPostRes, 200);
    const authorizeUrl = new URL(consentBody.redirect_url);
    expect(authorizeUrl.searchParams.get('prompt')).toBe('select_account');
    expect(authorizeUrl.searchParams.get('response_mode')).toBe('fragment');
    expect(authorizeUrl.searchParams.get('account_selection_state')).toBe(
      accountSelectionState,
    );

    const finalAuthorizeQuery: Record<string, string> & {
      response_type: string;
      client_id: string;
      redirect_uri: string;
      account_selected: '1';
      account_selection_state: string;
    } = {
      response_type: authorizeUrl.searchParams.get('response_type') ?? '',
      client_id: authorizeUrl.searchParams.get('client_id') ?? '',
      redirect_uri: authorizeUrl.searchParams.get('redirect_uri') ?? '',
      account_selected: '1',
      account_selection_state:
        authorizeUrl.searchParams.get('account_selection_state') ?? '',
    };
    for (const key of [
      'scope',
      'state',
      'nonce',
      'code_challenge',
      'code_challenge_method',
      'prompt',
      'max_age',
      'display',
      'response_mode',
      'login_hint',
      'ui_locales',
      'id_token_hint',
      'acr_values',
    ]) {
      const value = authorizeUrl.searchParams.get(key);
      if (value !== null) {
        finalAuthorizeQuery[key] = value;
      }
    }

    const finalRes = await client.oauth.authorize.$get(
      { query: finalAuthorizeQuery },
      { headers: { Cookie: `session=${chooserSessionCookie}` } },
    );
    expect(finalRes.status).toBe(302);
    const finalLocation = new URL(finalRes.headers.get('location') ?? '');
    expect(finalLocation.pathname).toBe(
      new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
    );
    const fragment = new URLSearchParams(finalLocation.hash.slice(1));
    expect(fragment.get('code')).toBeTruthy();
    expect(fragment.get('state')).toBe('account-selection-consent-state');
  });

  test('issues authorization code, ID token, access token, and userinfo for the selected account', async () => {
    const client = testClient(accountSelectionApp);
    const configRes =
      await client.oauth['.well-known']['openid-configuration'].$get();
    const config = await assertJsonBody(configRes, 200);
    const jwksPath = new URL(config.jwks_uri).pathname;
    const jwksRes = await accountSelectionApp.request(jwksPath);
    const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
    const sessionCookie = await createMultiAccountSession(ACCOUNT_B.sub);

    const consentRes = await client.api.consent.$post(
      {
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'account-selection-state',
          nonce: 'account-selection-nonce',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          decision: 'allow',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(consentRes.status).toBe(200);

    const chooserRes = await client.oauth.authorize.$get(
      {
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'account-selection-state',
          nonce: 'account-selection-nonce',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'select_account',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(chooserRes.status).toBe(302);
    const chooserLocation = new URL(chooserRes.headers.get('location') ?? '');
    expect(chooserLocation.pathname).toBe('/account/select');
    const accountSelectionState = chooserLocation.searchParams.get(
      'account_selection_state',
    );
    expect(accountSelectionState).not.toBeNull();
    const chooserSessionCookie = extractCookie(chooserRes, 'session');

    const authorizeRes = await client.oauth.authorize.$get(
      {
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'account-selection-state',
          nonce: 'account-selection-nonce',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'select_account',
          account_selected: '1',
          account_selection_state: accountSelectionState ?? '',
        },
      },
      { headers: { Cookie: `session=${chooserSessionCookie}` } },
    );
    expect(authorizeRes.status).toBe(302);
    const authorizeLocationHeader = authorizeRes.headers.get('location');
    expect(authorizeLocationHeader).not.toBeNull();
    const authorizeLocation = new URL(authorizeLocationHeader ?? '');
    expect(authorizeLocation.searchParams.get('state')).toBe(
      'account-selection-state',
    );
    const code = authorizeLocation.searchParams.get('code');
    expect(code).not.toBeNull();

    const tokenRes = await exchangeCodeForTokens(accountSelectionApp, {
      code: code ?? '',
      codeVerifier: TEST_PKCE.codeVerifier,
    });
    const tokens = await assertJsonBody(tokenRes, 200);
    const { payload } = await jose.jwtVerify(
      assertDefined(tokens.id_token),
      JWKS,
      {
        issuer: config.issuer,
        audience: TEST_OAUTH_CLIENT.clientId,
      },
    );

    expect(payload.sub).toBe(ACCOUNT_B.sub);
    expect(payload['email']).toBe(ACCOUNT_B.email);
    expect(payload['nonce']).toBe('account-selection-nonce');

    const userInfoRes = await getUserInfo(
      accountSelectionApp,
      tokens.access_token,
    );
    const userInfo = await assertJsonBody(userInfoRes, 200);
    expect(userInfo.sub).toBe(ACCOUNT_B.sub);
    expect(userInfo.email).toBe(ACCOUNT_B.email);
  });

  test('issues tokens for a login-hinted remembered account after prompt=login reauthentication through consent', async () => {
    const client = testClient(accountSelectionApp);
    const configRes =
      await client.oauth['.well-known']['openid-configuration'].$get();
    const config = await assertJsonBody(configRes, 200);
    const jwksPath = new URL(config.jwks_uri).pathname;
    const jwksRes = await accountSelectionApp.request(jwksPath);
    const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
    const sessionCookie = await createMultiAccountSession(ACCOUNT_A.sub);

    const authorizeQuery = {
      response_type: 'code',
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      scope: 'openid profile email',
      state: 'prompt-login-selected-account-state',
      nonce: 'prompt-login-selected-account-nonce',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      prompt: 'login consent',
      max_age: '0',
      login_hint: ACCOUNT_B.email,
    };

    const loginRedirectRes = await client.oauth.authorize.$get(
      { query: authorizeQuery },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(loginRedirectRes.status).toBe(302);
    const loginRedirect = new URL(
      loginRedirectRes.headers.get('location') ?? '',
    );
    expect(loginRedirect.pathname).toBe('/login');
    expect(loginRedirect.searchParams.get('login_hint')).toBe(ACCOUNT_B.email);
    const reauthCookie = extractCookie(loginRedirectRes, 'session');

    const loginBRes = await client.api.auth.login.$post(
      { json: { email: ACCOUNT_B.email, password: ACCOUNT_B.password } },
      { headers: { Cookie: `session=${reauthCookie}` } },
    );
    expect(loginBRes.status).toBe(200);
    const loggedInCookie = extractCookie(loginBRes, 'session');

    const consentRedirectRes = await client.oauth.authorize.$get(
      {
        query: {
          ...authorizeQuery,
          account_selected: '1',
          reauthenticated: '1',
        },
      },
      { headers: { Cookie: `session=${loggedInCookie}` } },
    );
    expect(consentRedirectRes.status).toBe(302);
    const consentLocation = new URL(
      consentRedirectRes.headers.get('location') ?? '',
    );
    expect(consentLocation.pathname).toBe('/consent');
    expect(consentLocation.searchParams.get('prompt')).toBe('consent');
    expect(consentLocation.searchParams.get('reauthenticated')).toBe('1');
    const consentCookie = extractCookie(consentRedirectRes, 'session');

    const consentPostRes = await client.api.consent.$post(
      {
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'prompt-login-selected-account-state',
          nonce: 'prompt-login-selected-account-nonce',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'consent',
          max_age: 0,
          login_hint: ACCOUNT_B.email,
          account_selected: '1',
          reauthenticated: '1',
          decision: 'allow',
        },
      },
      { headers: { Cookie: `session=${consentCookie}` } },
    );
    const consentBody = await assertJsonBody(consentPostRes, 200);
    const authorizeUrl = new URL(consentBody.redirect_url);
    expect(authorizeUrl.searchParams.get('reauthenticated')).toBe('1');
    expect(authorizeUrl.searchParams.get('account_selected')).toBe('1');
    const finalCookie = extractCookie(consentPostRes, 'session');

    const finalAuthorizeQuery: Record<string, string> & {
      response_type: string;
      client_id: string;
      redirect_uri: string;
    } = {
      response_type: authorizeUrl.searchParams.get('response_type') ?? '',
      client_id: authorizeUrl.searchParams.get('client_id') ?? '',
      redirect_uri: authorizeUrl.searchParams.get('redirect_uri') ?? '',
    };
    for (const key of [
      'scope',
      'state',
      'nonce',
      'code_challenge',
      'code_challenge_method',
      'prompt',
      'max_age',
      'login_hint',
      'account_selected',
      'reauthenticated',
    ]) {
      const value = authorizeUrl.searchParams.get(key);
      if (value !== null) {
        finalAuthorizeQuery[key] = value;
      }
    }
    const finalRes = await client.oauth.authorize.$get(
      { query: finalAuthorizeQuery },
      { headers: { Cookie: `session=${finalCookie}` } },
    );
    expect(finalRes.status).toBe(302);
    const finalLocation = new URL(finalRes.headers.get('location') ?? '');
    expect(finalLocation.pathname).toBe(
      new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
    );
    expect(finalLocation.searchParams.get('state')).toBe(
      'prompt-login-selected-account-state',
    );
    const code = finalLocation.searchParams.get('code');
    expect(code).toBeTruthy();

    const tokenRes = await exchangeCodeForTokens(accountSelectionApp, {
      code: code ?? '',
      codeVerifier: TEST_PKCE.codeVerifier,
    });
    const tokens = await assertJsonBody(tokenRes, 200);
    const { payload } = await jose.jwtVerify(
      assertDefined(tokens.id_token),
      JWKS,
      {
        issuer: config.issuer,
        audience: TEST_OAUTH_CLIENT.clientId,
      },
    );
    expect(payload.sub).toBe(ACCOUNT_B.sub);
    expect(payload['email']).toBe(ACCOUNT_B.email);

    const userInfoRes = await getUserInfo(
      accountSelectionApp,
      tokens.access_token,
    );
    const userInfo = await assertJsonBody(userInfoRes, 200);
    expect(userInfo.sub).toBe(ACCOUNT_B.sub);
    expect(userInfo.email).toBe(ACCOUNT_B.email);
  });

  test('does not issue tokens for an expired remembered account through stale chooser state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: true,
            ttl: '5s',
          },
        },
      },
      users: [ACCOUNT_A, ACCOUNT_B],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    });
    try {
      const client = testClient(scopedServer.app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();
      const config = await assertJsonBody(configRes, 200);
      const jwksPath = new URL(config.jwks_uri).pathname;
      const jwksRes = await scopedServer.app.request(jwksPath);
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
      const authenticatedAt = 1_700_000_000;
      const sessionCookie = await encrypt(
        JSON.stringify({
          user: {
            sub: ACCOUNT_B.sub,
            authenticated_at: authenticatedAt,
          },
          accounts: [
            {
              sub: ACCOUNT_A.sub,
              authenticated_at: authenticatedAt,
              last_used_at: authenticatedAt,
            },
            {
              sub: ACCOUNT_B.sub,
              authenticated_at: authenticatedAt,
              last_used_at: authenticatedAt,
            },
          ],
        }),
        MINIMAL_TEST_CONFIG.security.session_secret,
      );
      await grantConsent(scopedServer.app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
      });

      const authorizeQuery = {
        response_type: 'code',
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
        state: 'expired-account-selection-state',
        nonce: 'expired-account-selection-nonce',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
        prompt: 'select_account',
      };
      const chooserRes = await client.oauth.authorize.$get(
        { query: authorizeQuery },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(chooserRes.status).toBe(302);
      const chooserLocation = new URL(chooserRes.headers.get('location') ?? '');
      expect(chooserLocation.pathname).toBe('/account/select');
      const accountSelectionState = chooserLocation.searchParams.get(
        'account_selection_state',
      );
      expect(accountSelectionState).not.toBeNull();
      const chooserCookie = extractCookie(chooserRes, 'session');

      vi.setSystemTime(new Date(1_700_000_010_000));
      const selectExpiredRes = await client.api.auth.accounts.select.$post(
        { json: { sub: ACCOUNT_A.sub } },
        { headers: { Cookie: `session=${chooserCookie}` } },
      );
      expect(selectExpiredRes.status).toBe(400);
      await expect(selectExpiredRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_NOT_REMEMBERED',
      });

      const finalAuthorizeRes = await client.oauth.authorize.$get(
        {
          query: {
            ...authorizeQuery,
            account_selected: '1',
            account_selection_state: accountSelectionState ?? '',
          },
        },
        { headers: { Cookie: `session=${chooserCookie}` } },
      );
      expect(finalAuthorizeRes.status).toBe(302);
      const finalLocation = new URL(
        finalAuthorizeRes.headers.get('location') ?? '',
      );
      expect(finalLocation.pathname).toBe(
        new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
      );
      const code = finalLocation.searchParams.get('code');
      expect(code).toBeTruthy();

      const tokenRes = await exchangeCodeForTokens(scopedServer.app, {
        code: code ?? '',
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      const tokens = await assertJsonBody(tokenRes, 200);
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
        {
          issuer: config.issuer,
          audience: TEST_OAUTH_CLIENT.clientId,
        },
      );
      expect(payload.sub).toBe(ACCOUNT_B.sub);
      expect(payload.sub).not.toBe(ACCOUNT_A.sub);

      const userInfoRes = await getUserInfo(
        scopedServer.app,
        tokens.access_token,
      );
      const userInfo = await assertJsonBody(userInfoRes, 200);
      expect(userInfo.sub).toBe(ACCOUNT_B.sub);
      expect(userInfo.email).toBe(ACCOUNT_B.email);
    } finally {
      vi.useRealTimers();
      await scopedServer.cleanup();
    }
  });

  test('does not issue tokens for a max_accounts-evicted account through stale chooser state', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: true,
            max_accounts: 2,
          },
        },
      },
      users: [ACCOUNT_A, ACCOUNT_B, ACCOUNT_C],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    });
    try {
      const client = testClient(scopedServer.app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();
      const config = await assertJsonBody(configRes, 200);
      const jwksPath = new URL(config.jwks_uri).pathname;
      const jwksRes = await scopedServer.app.request(jwksPath);
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
      const authenticatedAt = Math.floor(Date.now() / 1000) - 10;
      const authorizeQuery = {
        response_type: 'code',
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
        state: 'max-cap-account-selection-state',
        nonce: 'max-cap-account-selection-nonce',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
        prompt: 'select_account',
      };
      const accountSelectionState = 'stale-max-cap-account-selection-state';
      const accountSelectionFingerprint = JSON.stringify([
        ['client_id', authorizeQuery.client_id],
        ['redirect_uri', authorizeQuery.redirect_uri],
        ['response_type', authorizeQuery.response_type],
        ['scope', authorizeQuery.scope],
        ['state', authorizeQuery.state],
        ['nonce', authorizeQuery.nonce],
        ['code_challenge', authorizeQuery.code_challenge],
        ['code_challenge_method', authorizeQuery.code_challenge_method],
        ['prompt', authorizeQuery.prompt],
      ]);
      const staleChooserCookie = await encrypt(
        JSON.stringify({
          user: {
            sub: ACCOUNT_C.sub,
            authenticated_at: authenticatedAt,
          },
          accounts: [
            {
              sub: ACCOUNT_A.sub,
              authenticated_at: authenticatedAt - 20,
              last_used_at: authenticatedAt - 20,
            },
            {
              sub: ACCOUNT_B.sub,
              authenticated_at: authenticatedAt - 10,
              last_used_at: authenticatedAt - 10,
            },
            {
              sub: ACCOUNT_C.sub,
              authenticated_at: authenticatedAt,
              last_used_at: authenticatedAt,
            },
          ],
          accountSelection: {
            id: accountSelectionState,
            client_id: TEST_OAUTH_CLIENT.clientId,
            request_fingerprint: accountSelectionFingerprint,
            allow_add_account: true,
            allowed_subs: [ACCOUNT_A.sub, ACCOUNT_B.sub, ACCOUNT_C.sub],
            created_at: authenticatedAt,
          },
        }),
        MINIMAL_TEST_CONFIG.security.session_secret,
      );
      await grantConsent(scopedServer.app, staleChooserCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
      });

      const selectEvictedRes = await client.api.auth.accounts.select.$post(
        { json: { sub: ACCOUNT_A.sub } },
        { headers: { Cookie: `session=${staleChooserCookie}` } },
      );
      expect(selectEvictedRes.status).toBe(400);
      await expect(selectEvictedRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_NOT_REMEMBERED',
      });

      const finalAuthorizeRes = await client.oauth.authorize.$get(
        {
          query: {
            ...authorizeQuery,
            account_selected: '1',
            account_selection_state: accountSelectionState,
          },
        },
        { headers: { Cookie: `session=${staleChooserCookie}` } },
      );
      expect(finalAuthorizeRes.status).toBe(302);
      const finalLocation = new URL(
        finalAuthorizeRes.headers.get('location') ?? '',
      );
      expect(finalLocation.pathname).toBe(
        new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
      );
      const code = finalLocation.searchParams.get('code');
      expect(code).toBeTruthy();

      const tokenRes = await exchangeCodeForTokens(scopedServer.app, {
        code: code ?? '',
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      const tokens = await assertJsonBody(tokenRes, 200);
      const { payload } = await jose.jwtVerify(
        assertDefined(tokens.id_token),
        JWKS,
        {
          issuer: config.issuer,
          audience: TEST_OAUTH_CLIENT.clientId,
        },
      );
      expect(payload.sub).toBe(ACCOUNT_C.sub);
      expect(payload.sub).not.toBe(ACCOUNT_A.sub);

      const userInfoRes = await getUserInfo(
        scopedServer.app,
        tokens.access_token,
      );
      const userInfo = await assertJsonBody(userInfoRes, 200);
      expect(userInfo.sub).toBe(ACCOUNT_C.sub);
      expect(userInfo.email).toBe(ACCOUNT_C.email);
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('OP logout clears active and remembered account-selection session state', async () => {
    const client = testClient(accountSelectionApp);
    const sessionCookie = await createMultiAccountSession(ACCOUNT_A.sub);

    const chooserRes = await client.oauth.authorize.$get(
      {
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'logout-account-selection-state',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'select_account',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(chooserRes.status).toBe(302);
    expect(new URL(chooserRes.headers.get('location') ?? '').pathname).toBe(
      '/account/select',
    );
    const chooserCookie = extractCookie(chooserRes, 'session');

    const logoutRes = await accountSelectionApp.request('/oauth/end_session', {
      headers: { Cookie: `session=${chooserCookie}` },
    });
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.get('location')).toBe('http://localhost:8080');
    expect(logoutRes.headers.get('set-cookie')).toContain('session=;');

    const browserSessionAfterLogout = applySessionSetCookie(
      chooserCookie,
      logoutRes.headers.get('set-cookie'),
    );
    expect(browserSessionAfterLogout).toBeUndefined();

    const authorizeAfterLogoutRes = await client.oauth.authorize.$get(
      {
        query: {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'logout-after-state',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
        },
      },
      browserSessionAfterLogout
        ? { headers: { Cookie: `session=${browserSessionAfterLogout}` } }
        : undefined,
    );
    expect(authorizeAfterLogoutRes.status).toBe(302);
    const authorizeAfterLogoutLocation = new URL(
      authorizeAfterLogoutRes.headers.get('location') ?? '',
    );
    expect(authorizeAfterLogoutLocation.pathname).toBe('/login');
    expect(authorizeAfterLogoutLocation.searchParams.has('code')).toBe(false);
  });
});
