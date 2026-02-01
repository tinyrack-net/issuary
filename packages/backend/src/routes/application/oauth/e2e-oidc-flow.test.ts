import type { FastifyInstance } from 'fastify';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getUserInfo,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      providers: [TEST_OAUTH_CLIENT_CONFIG],
    },
  });
});

afterAll(async () => {
  await app.close();
});

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
  describe('Complete Discovery-Based Flow', () => {
    test('should complete full OIDC flow with signature verification', async () => {
      // Step 1: Discover OIDC configuration
      const configRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/openid-configuration',
      });

      expect(configRes.statusCode).toBe(200);
      const config = configRes.json();

      expect(config.issuer).toBeDefined();
      expect(config.authorization_endpoint).toBeDefined();
      expect(config.token_endpoint).toBeDefined();
      expect(config.jwks_uri).toBeDefined();
      expect(config.userinfo_endpoint).toBeDefined();

      // Step 2: Fetch JWKS for token verification
      const jwksUrl = new URL(config.jwks_uri);
      const jwksRes = await app.inject({
        method: 'GET',
        url: jwksUrl.pathname,
      });

      expect(jwksRes.statusCode).toBe(200);
      const jwks = jwksRes.json();

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

      expect(tokenRes.statusCode).toBe(200);
      const tokens = tokenRes.json();

      expect(tokens.access_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBeDefined();

      // Step 5: Verify ID token signature using JWKS
      const { payload: idTokenPayload, protectedHeader: idTokenHeader } =
        await jose.jwtVerify(tokens.id_token, JWKS, {
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

      expect(userInfoRes.statusCode).toBe(200);
      const userInfo = userInfoRes.json();

      expect(userInfo.sub).toBe(idTokenPayload.sub);
      expect(userInfo.email).toBe(TEST_USER.email);
    });

    test('should have consistent kid between JWKS and tokens', async () => {
      // Get JWKS
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });

      const jwks = jwksRes.json();
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

      const tokens = tokenRes.json();

      // Decode tokens to check kid
      const idTokenHeader = jose.decodeProtectedHeader(tokens.id_token);
      const accessTokenHeader = jose.decodeProtectedHeader(tokens.access_token);

      // Verify kid exists in JWKS
      expect(availableKids).toContain(idTokenHeader.kid);
      expect(availableKids).toContain(accessTokenHeader.kid);
    });
  });

  describe('ID Token Verification', () => {
    test('should verify ID token has required OIDC claims', async () => {
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      const JWKS = jose.createLocalJWKSet(jwksRes.json());

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

      const tokens = tokenRes.json();
      const { payload } = await jose.jwtVerify(tokens.id_token, JWKS);

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
      const { payload } = await jose.jwtVerify(tokens.id_token, JWKS);

      // OIDC Core 1.0 §3.1.3.6: at_hash should be present
      expect(payload['at_hash']).toBeDefined();
      expect(typeof payload['at_hash']).toBe('string');
    });

    test('should verify at_hash matches access token', async () => {
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
      const { payload } = await jose.jwtVerify(tokens.id_token, JWKS);

      // Compute at_hash manually to verify
      // OIDC Core 1.0 §3.1.3.6: at_hash = base64url(left_half(sha256(access_token)))
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update(tokens.access_token).digest();
      const leftHalf = hash.subarray(0, hash.length / 2);
      const expectedAtHash = leftHalf.toString('base64url');

      expect(payload['at_hash']).toBe(expectedAtHash);
    });

    test('should include user claims based on requested scopes', async () => {
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      const JWKS = jose.createLocalJWKSet(jwksRes.json());

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

      const tokens = tokenRes.json();
      const { payload } = await jose.jwtVerify(tokens.id_token, JWKS);

      // Profile scope claims
      // (may or may not be in ID token - implementation specific)

      // Email scope claims (often in ID token when email scope requested)
      expect(payload['email']).toBe(TEST_USER.email);
      expect(payload['email_verified']).toBeDefined();
    });
  });

  describe('Access Token Verification', () => {
    test('should verify access token has required claims', async () => {
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

      // Refresh the token
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      expect(refreshRes.statusCode).toBe(200);
      const newTokens = refreshRes.json();

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
      const { payload: originalPayload } = await jose.jwtVerify(
        tokens.access_token,
        JWKS,
      );

      // Refresh the token
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/application/oauth/token',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      const newTokens = refreshRes.json();
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
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });
      const JWKS = jose.createLocalJWKSet(jwksRes.json());

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

      const tokens = tokenRes.json();
      const { payload: idTokenClaims } = await jose.jwtVerify(
        tokens.id_token,
        JWKS,
      );

      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfoClaims = userInfoRes.json();

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

      const tokens = tokenRes.json();
      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const userInfo = userInfoRes.json();

      // Should have sub (always present)
      expect(userInfo.sub).toBeDefined();

      // Should have email claims (email scope)
      expect(userInfo.email).toBeDefined();
    });
  });

  describe('JWKS Key Properties', () => {
    test('should have RSA key with proper structure', async () => {
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });

      const jwks = jwksRes.json();

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
        expect(key.d).toBeUndefined(); // private exponent
        expect(key.p).toBeUndefined(); // first prime factor
        expect(key.q).toBeUndefined(); // second prime factor
        expect(key.dp).toBeUndefined(); // first factor CRT exponent
        expect(key.dq).toBeUndefined(); // second factor CRT exponent
        expect(key.qi).toBeUndefined(); // first CRT coefficient
      }
    });

    test('should be able to import JWKS key and verify token', async () => {
      const jwksRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/jwks',
      });

      const jwks = jwksRes.json();

      // Import the first key
      const key = jwks.keys[0];
      const publicKey = await jose.importJWK(key, 'RS256');

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

      const tokens = tokenRes.json();

      // Verify using the imported key
      const tokenHeader = jose.decodeProtectedHeader(tokens.id_token);

      // Only verify if the token was signed with this key
      if (tokenHeader.kid === key.kid) {
        const { payload } = await jose.jwtVerify(tokens.id_token, publicKey);
        expect(payload.sub).toBeDefined();
      }
    });
  });

  describe('OpenID Configuration Compliance', () => {
    test('should list all advertised endpoints as working', async () => {
      const configRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/openid-configuration',
      });

      const config = configRes.json();

      // Test JWKS URI
      const jwksUrl = new URL(config.jwks_uri);
      const jwksRes = await app.inject({
        method: 'GET',
        url: jwksUrl.pathname,
      });
      expect(jwksRes.statusCode).toBe(200);

      // Authorization endpoint requires params, just verify path exists
      const authUrl = new URL(config.authorization_endpoint);
      expect(authUrl.pathname).toContain('/authorize');

      // Token endpoint requires params
      const tokenUrl = new URL(config.token_endpoint);
      expect(tokenUrl.pathname).toContain('/token');

      // UserInfo endpoint requires auth
      const userinfoUrl = new URL(config.userinfo_endpoint);
      expect(userinfoUrl.pathname).toContain('/userinfo');
    });

    test('should support advertised grant types', async () => {
      const configRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/openid-configuration',
      });

      const config = configRes.json();

      // Test authorization_code grant
      if (config.grant_types_supported.includes('authorization_code')) {
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
      }

      // Test refresh_token grant
      if (config.grant_types_supported.includes('refresh_token')) {
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

        const refreshRes = await app.inject({
          method: 'POST',
          url: '/application/oauth/token',
          payload: {
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            client_id: TEST_OAUTH_CLIENT.clientId,
          },
        });

        expect(refreshRes.statusCode).toBe(200);
      }
    });

    test('should support advertised response types', async () => {
      const configRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/openid-configuration',
      });

      const config = configRes.json();

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
      const configRes = await app.inject({
        method: 'GET',
        url: '/application/oauth/.well-known/openid-configuration',
      });

      const config = configRes.json();

      // Verify openid scope is supported and works
      expect(config.scopes_supported).toContain('openid');

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: config.scopes_supported.join(' '),
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });

      expect(code).toBeDefined();
    });
  });

  describe('Error Scenarios with Valid JWKS', () => {
    test('should reject token with tampered signature', async () => {
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

      // Tamper with the token signature (modify last few chars)
      const parts = tokens.access_token.split('.');
      const tamperedSignature = `${parts[2]?.slice(0, -4)}XXXX`;
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      // Verification should fail
      await expect(jose.jwtVerify(tamperedToken, JWKS)).rejects.toThrow();
    });

    test('should reject token with wrong issuer', async () => {
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

      // Verify with wrong issuer should fail
      await expect(
        jose.jwtVerify(tokens.id_token, JWKS, {
          issuer: 'https://wrong-issuer.example.com',
        }),
      ).rejects.toThrow();
    });

    test('should reject token with wrong audience', async () => {
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

      // Verify with wrong audience should fail
      await expect(
        jose.jwtVerify(tokens.id_token, JWKS, {
          audience: 'wrong-client-id',
        }),
      ).rejects.toThrow();
    });
  });
});
