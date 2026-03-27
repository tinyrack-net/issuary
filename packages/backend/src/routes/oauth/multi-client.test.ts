import { testClient } from 'hono/testing';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import {
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getLocationHeader,
  getUserInfo,
  introspectToken,
  MINIMAL_TEST_CONFIG,
  parseJwks,
  refreshAccessToken,
  revokeToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

const SECOND_OAUTH_CLIENT = {
  clientId: 'second-client-id',
  clientSecret: 'second-client-secret',
  redirectUri: 'http://localhost:3001/callback',
} as const;

const SECOND_OAUTH_CLIENT_CONFIG = {
  id: 'second-oauth-client',
  name: 'Second Client',
  logo_uri: 'https://second-client.com/logo',
  client_id: SECOND_OAUTH_CLIENT.clientId,
  client_secret: SECOND_OAUTH_CLIENT.clientSecret,
  redirect_uris: [SECOND_OAUTH_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email',
};

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG, SECOND_OAUTH_CLIENT_CONFIG],
  }));
});

afterAll(async () => {
  await cleanup();
});

describe('Multi-Client Isolation', () => {
  describe('Token Isolation Between Clients', () => {
    test('should issue different tokens for different clients', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      expect(tokenRes1.status).toBe(200);
      const tokens1 = await tokenRes1.json();

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
      expect(tokenRes2.status).toBe(200);
      const tokens2 = await tokenRes2.json();

      expect(tokens1.access_token).not.toBe(tokens2.access_token);
      expect(tokens1.refresh_token).not.toBe(tokens2.refresh_token);
      expect(tokens1.id_token).not.toBe(tokens2.id_token);
    });

    test('should have correct client_id in token claims', {
      timeout: 15000,
    }, async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();
      const { payload: payload1 } = await jose.jwtVerify(
        tokens1.access_token,
        JWKS,
      );
      expect(payload1['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);

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
      const tokens2 = await tokenRes2.json();
      const { payload: payload2 } = await jose.jwtVerify(
        tokens2.access_token,
        JWKS,
      );
      expect(payload2['client_id']).toBe(SECOND_OAUTH_CLIENT.clientId);
    });

    test('should have same subject for same user across clients', {
      timeout: 15000,
    }, async () => {
      const jwksClient = testClient(app);
      const jwksRes = await jwksClient.oauth['.well-known'].jwks.$get();
      const JWKS = jose.createLocalJWKSet(await parseJwks(jwksRes));
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();
      const { payload: payload1 } = await jose.jwtVerify(
        tokens1.id_token,
        JWKS,
      );

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
      const tokens2 = await tokenRes2.json();
      const { payload: payload2 } = await jose.jwtVerify(
        tokens2.id_token,
        JWKS,
      );

      expect(payload1.sub).toBe(payload2.sub);
      expect(payload1.aud).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(payload2.aud).toBe(SECOND_OAUTH_CLIENT.clientId);
    });
  });

  describe('Cross-Client Token Usage Prevention', () => {
    test('should reject refresh token from different client', {
      timeout: 15000,
    }, async () => {
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
      const tokens = await tokenRes.json();

      const refreshClient = testClient(app);
      const refreshRes = await refreshClient.oauth.token.$post({
        form: {
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: SECOND_OAUTH_CLIENT.clientId,
          client_secret: SECOND_OAUTH_CLIENT.clientSecret,
        },
      });
      expect([400, 401]).toContain(refreshRes.status);
    });

    test('should reject authorization code exchange with wrong client', {
      timeout: 15000,
    }, async () => {
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
        clientId: SECOND_OAUTH_CLIENT.clientId,
        clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
        redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      expect([400, 401]).toContain(tokenRes.status);
    });
  });

  describe('Client Credential Validation', () => {
    test('should reject non-existent client_id', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );
      const authClient = testClient(app);
      const authRes = await authClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: 'non-existent-client',
            redirect_uri: 'http://localhost:8080/callback',
            scope: 'openid profile email',
            state: 'test-state',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect([400, 302]).toContain(authRes.status);
      if (authRes.status === 302) {
        const location = new URL(
          getLocationHeader(authRes),
          'http://localhost:8080',
        );
        expect(location.searchParams.has('error')).toBe(true);
      }
    });
  });

  describe('Token Introspection Isolation', () => {
    test('should introspect token with correct client credentials', {
      timeout: 15000,
    }, async () => {
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
      const tokens = await tokenRes.json();

      const introspectRes = await introspectToken(app, {
        token: tokens.access_token,
        tokenTypeHint: 'access_token',
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      expect(introspectRes.status).toBe(200);
      const introspection = await introspectRes.json();
      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
    });

    test('should show token metadata with correct client_id', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();

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
      const tokens2 = await tokenRes2.json();

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
      expect((await intro1.json()).client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect((await intro2.json()).client_id).toBe(
        SECOND_OAUTH_CLIENT.clientId,
      );
    });
  });

  describe('Token Revocation Isolation', () => {
    test('should only revoke tokens for the requesting client', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();

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
      const tokens2 = await tokenRes2.json();

      const revokeRes = await revokeToken(app, {
        token: tokens1.access_token,
        tokenTypeHint: 'access_token',
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      expect(revokeRes.status).toBe(200);

      const userInfo1Res = await getUserInfo(app, tokens1.access_token);
      expect(userInfo1Res.status).toBe(401);
      const userInfo2Res = await getUserInfo(app, tokens2.access_token);
      expect(userInfo2Res.status).toBe(200);
    });
  });

  describe('UserInfo Access with Different Client Tokens', () => {
    test('should return same user info for tokens from different clients', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();

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
      const tokens2 = await tokenRes2.json();

      const userInfo1Res = await getUserInfo(app, tokens1.access_token);
      const userInfo2Res = await getUserInfo(app, tokens2.access_token);
      expect(userInfo1Res.status).toBe(200);
      expect(userInfo2Res.status).toBe(200);

      const userInfo1 = await userInfo1Res.json();
      const userInfo2 = await userInfo2Res.json();
      expect(userInfo1.sub).toBe(userInfo2.sub);
      expect(userInfo1.email).toBe(userInfo2.email);
      expect(userInfo1.email).toBe(TEST_USER.email);
    });
  });

  describe('Independent Consent Per Client', () => {
    test('should require separate consent for each client', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

      const { code: code1 } = await getAuthorizationCode(app, {
        sessionCookie,
        clientId: TEST_OAUTH_CLIENT.clientId,
        redirectUri: TEST_OAUTH_CLIENT.redirectUri,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });
      expect(code1).toBeDefined();

      const { code: code2 } = await getAuthorizationCode(app, {
        sessionCookie,
        clientId: SECOND_OAUTH_CLIENT.clientId,
        redirectUri: SECOND_OAUTH_CLIENT.redirectUri,
        codeChallenge: TEST_PKCE.codeChallenge,
        codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
      });
      expect(code2).toBeDefined();
      expect(code1).not.toBe(code2);
    });
  });

  describe('Simultaneous Sessions', () => {
    test('should maintain independent token sets for same user with multiple clients', {
      timeout: 15000,
    }, async () => {
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

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
      const tokens1 = await tokenRes1.json();

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
      const tokens2 = await tokenRes2.json();

      const refresh1Res = await refreshAccessToken(app, {
        refreshToken: tokens1.refresh_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      expect(refresh1Res.status).toBe(200);

      const refresh2Res = await refreshAccessToken(app, {
        refreshToken: tokens2.refresh_token,
        clientId: SECOND_OAUTH_CLIENT.clientId,
        clientSecret: SECOND_OAUTH_CLIENT.clientSecret,
      });
      expect(refresh2Res.status).toBe(200);

      const newTokens1 = await refresh1Res.json();
      const newTokens2 = await refresh2Res.json();
      expect(newTokens1.access_token).not.toBe(newTokens2.access_token);
    });
  });
});
