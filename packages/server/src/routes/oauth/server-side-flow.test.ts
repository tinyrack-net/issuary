import { testClient } from 'hono/testing';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../entrypoints/app.ts';
import {
  assertDefined,
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens,
  getAuthorizationCode,
  getUserInfo,
  introspectToken,
  MINIMAL_TEST_CONFIG,
  refreshAccessToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  }));
});

afterAll(async () => {
  await cleanup();
});

/**
 * Create Basic Auth header from client credentials
 */
function createBasicAuthHeader(clientId: string, clientSecret: string): string {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );
  return `Basic ${credentials}`;
}

/**
 * Server-Side (Confidential Client) Authentication Flow Tests
 */
describe('Server-Side Confidential Client Authentication Flow', () => {
  describe('Client Secret Post Authentication', () => {
    test('should exchange code with client_secret in request body', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      const tokens = await assertJsonBody(tokenRes);
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();
      expect(tokens.token_type).toBe('Bearer');
    });

    test('should reject request with wrong client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: 'wrong-secret',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      const errorBody = await assertJsonBody(tokenRes, 401);
      expect(errorBody.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject request with empty client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: '',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect([400, 401]).toContain(tokenRes.status);
    });
  });

  describe('Client Secret Basic Authentication', () => {
    test('should exchange code with Basic auth header and client_id in body', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post(
        {
          form: {
            grant_type: 'authorization_code',
            code,
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              TEST_OAUTH_CLIENT.clientSecret,
            ),
          },
        },
      );

      const tokens = await assertJsonBody(tokenRes);
      expect(tokens.access_token).toBeDefined();
    });

    test('should reject missing client_id in body even with Basic auth', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post(
        {
          // @ts-expect-error testing validation with invalid input
          form: {
            grant_type: 'authorization_code',
            code,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              'wrong-secret',
            ),
          },
        },
      );

      expect(tokenRes.status).toBe(400);
    });

    test('should use body credentials regardless of Basic auth header', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post(
        {
          form: {
            grant_type: 'authorization_code',
            code,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              'ignored-header-secret',
            ),
          },
        },
      );

      expect(tokenRes.status).toBe(200);
    });
  });

  describe('Authentication Method Priority', () => {
    test('should use body credentials when both body and header provided', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post(
        {
          form: {
            grant_type: 'authorization_code',
            code,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              'wrong-header-secret',
            ),
          },
        },
      );

      expect(tokenRes.status).toBe(200);
    });
  });

  describe('Refresh Token with Client Authentication', () => {
    test('should refresh token with client_secret_post', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { refresh_token } = await tokenRes.json();

      const refreshClient = testClient(app);
      const refreshRes = await refreshClient.oauth.token.$post({
        form: {
          grant_type: 'refresh_token',
          refresh_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
        },
      });

      const refreshBody = await assertJsonBody(refreshRes);
      expect(refreshBody.access_token).toBeDefined();
    });

    test('should refresh token with client_secret_basic', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { refresh_token } = await tokenRes.json();

      const refreshClient = testClient(app);
      const refreshRes = await refreshClient.oauth.token.$post(
        {
          form: {
            grant_type: 'refresh_token',
            refresh_token,
            client_id: TEST_OAUTH_CLIENT.clientId,
          },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              TEST_OAUTH_CLIENT.clientSecret,
            ),
          },
        },
      );

      const refreshBasicBody = await assertJsonBody(refreshRes);
      expect(refreshBasicBody.access_token).toBeDefined();
    });

    test('should reject refresh with wrong client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { refresh_token } = await tokenRes.json();

      const refreshRes = await refreshAccessToken(app, {
        refreshToken: refresh_token,
        clientSecret: 'wrong-secret',
      });

      const json = await assertJsonBody(refreshRes, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });
  });

  describe('Token Introspection with Client Authentication', () => {
    test('should introspect with client_secret_post', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { access_token } = await tokenRes.json();

      const introspectRes = await introspectToken(app, {
        token: access_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      const json = await assertJsonBody(introspectRes, 200);
      expect(json.active).toBe(true);
    });

    test('should introspect with client_secret_basic', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { access_token } = await tokenRes.json();

      const introspectClient = testClient(app);
      const introspectRes = await introspectClient.oauth.introspect.$post(
        {
          form: { token: access_token },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              TEST_OAUTH_CLIENT.clientSecret,
            ),
          },
        },
      );

      const introspectBody = await assertJsonBody(introspectRes);
      expect(introspectBody.active).toBe(true);
    });

    test('should reject introspection with wrong client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const introspectRes = await introspectToken(app, {
        token: access_token,
        clientSecret: 'wrong-secret',
      });

      expect(introspectRes.status).toBe(401);
    });
  });

  describe('Token Revocation with Client Authentication', () => {
    test('should revoke with client_secret_post', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { access_token } = await tokenRes.json();

      const revokeClient = testClient(app);
      const revokeRes = await revokeClient.oauth.revoke.$post({
        form: {
          token: access_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
        },
      });

      expect(revokeRes.status).toBe(200);

      const introspectRes = await introspectToken(app, { token: access_token });
      expect((await introspectRes.json()).active).toBe(false);
    });

    test('should revoke with client_secret_basic', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { access_token } = await tokenRes.json();

      const revokeClient = testClient(app);
      const revokeRes = await revokeClient.oauth.revoke.$post(
        {
          form: { token: access_token },
        },
        {
          headers: {
            authorization: createBasicAuthHeader(
              TEST_OAUTH_CLIENT.clientId,
              TEST_OAUTH_CLIENT.clientSecret,
            ),
          },
        },
      );

      expect(revokeRes.status).toBe(200);
    });

    test('should reject revocation with wrong client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const revokeClient = testClient(app);
      const revokeRes = await revokeClient.oauth.revoke.$post({
        form: {
          token: access_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: 'wrong-secret',
        },
      });

      expect(revokeRes.status).toBe(401);
    });
  });

  describe('Server-Side Complete Flow', () => {
    test('should complete full confidential client flow', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, location } = await getAuthorizationCode(app, {
        sessionCookie,
        state: 'server-side-state',
      });

      expect(code).toBeDefined();
      expect(location.searchParams.get('state')).toBe('server-side-state');

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(tokenRes.status).toBe(200);
      const tokens = await tokenRes.json();

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();

      const accessDecoded = jose.decodeJwt(tokens.access_token);
      const idDecoded = jose.decodeJwt(assertDefined(tokens.id_token));

      expect(accessDecoded['client_id']).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(idDecoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);

      const userInfoRes = await getUserInfo(app, tokens.access_token);
      const json = await assertJsonBody(userInfoRes, 200);
      expect(json.email).toBe(TEST_USER.email);

      const refreshRes = await refreshAccessToken(app, {
        refreshToken: tokens.refresh_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      expect(refreshRes.status).toBe(200);
    });
  });

  describe('Confidential Client with PKCE', () => {
    test('should support PKCE even for confidential clients', async () => {
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: codeVerifier,
        },
      });

      const pkceTokens = await assertJsonBody(tokenRes);
      expect(pkceTokens.access_token).toBeDefined();
    });

    test('should require code_verifier when challenge was provided, even with client_secret', async () => {
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      const missingVerifierBody = await assertJsonBody(tokenRes, 400);
      expect(missingVerifierBody.code).toBe('MISSING_CODE_VERIFIER');
    });
  });

  describe('Client ID Validation', () => {
    test('should reject unknown client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: 'unknown-client-id',
          client_secret: 'some-secret',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      const unknownClientBody = await assertJsonBody(tokenRes, 400);
      expect(unknownClientBody.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should reject mismatched client_id in token request', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: 'different-client-id',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect(tokenRes.status).toBe(400);
    });
  });

  describe('ID Token Claims for Confidential Clients', () => {
    test('should include azp claim when client authenticates', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const tokens = await tokenRes.json();

      const decoded = jose.decodeJwt(assertDefined(tokens.id_token));
      expect(decoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);
    });

    test('should include auth_time when max_age is specified', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        nonce: 'test-nonce',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const tokens = await tokenRes.json();

      const decoded = jose.decodeJwt(assertDefined(tokens.id_token));
      expect(decoded.sub).toBeDefined();
      expect(decoded.iss).toBeDefined();
      expect(decoded.aud).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(decoded['nonce']).toBe('test-nonce');
    });
  });

  describe('Error Responses', () => {
    test('should return proper error format for invalid client credentials', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: 'wrong-secret',
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      const error = await assertJsonBody(tokenRes, 401);
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');
    });

    test('should return proper error for missing grant type', async () => {
      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        // @ts-expect-error testing validation with invalid input
        form: {
          code: 'some-code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        },
      });

      expect(tokenRes.status).toBe(400);
    });
  });

  describe('Scope Handling', () => {
    test('should respect requested scopes', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(tokenRes.status).toBe(200);
      const tokens = await tokenRes.json();
      expect(tokens.scope).toBe('openid profile');

      const decoded = jose.decodeJwt(assertDefined(tokens.id_token));
      expect(decoded['name']).toBeDefined();
      expect(decoded['email']).toBeUndefined();
    });

    test('should include all claims for full scope request', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
      });

      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      const tokens = await tokenRes.json();
      const decoded = jose.decodeJwt(assertDefined(tokens.id_token));
      expect(decoded['name']).toBeDefined();
      expect(decoded['email']).toBeDefined();
      expect(decoded['email_verified']).toBeDefined();
    });
  });
});
