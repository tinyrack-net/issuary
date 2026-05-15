import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens as exchangeCodeForTokensRequest,
  getAuthorizationCode,
  getUserInfo,
  MINIMAL_TEST_CONFIG,
  refreshAccessToken,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

const PUBLIC_OAUTH_CLIENT = {
  clientId: 'public-revoke-client',
  redirectUri: 'http://localhost:8080/public-revoke-callback',
} as const;

const PUBLIC_OAUTH_CLIENT_CONFIG = {
  id: 'public-revoke-client-config',
  name: 'Public Revoke Client',
  client_id: PUBLIC_OAUTH_CLIENT.clientId,
  redirect_uris: [PUBLIC_OAUTH_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email',
};

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG, PUBLIC_OAUTH_CLIENT_CONFIG],
  }));
});

afterAll(async () => {
  await cleanup();
});

/**
 * Helper: Revoke a token
 */
async function revokeToken(params: {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
  clientId?: string;
  clientSecret?: string;
}) {
  const clientId = params.clientId ?? TEST_OAUTH_CLIENT.clientId;
  const clientSecret =
    params.clientSecret ??
    (clientId === TEST_OAUTH_CLIENT.clientId
      ? TEST_OAUTH_CLIENT.clientSecret
      : undefined);
  const client = testClient(app);
  return client.oauth.revoke.$post({
    form: {
      token: params.token,
      ...(params.tokenTypeHint != null
        ? { token_type_hint: params.tokenTypeHint }
        : {}),
      client_id: clientId,
      ...(clientSecret != null ? { client_secret: clientSecret } : {}),
    },
  });
}

/**
 * Helper: Introspect a token
 */
async function introspectToken(token: string) {
  const client = testClient(app);
  return client.oauth.introspect.$post({
    form: {
      token,
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    },
  });
}

async function exchangeCodeForTokens(
  honoApp: AppType,
  params: {
    code: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    codeVerifier?: string;
  },
) {
  return exchangeCodeForTokensRequest(honoApp, {
    clientSecret: TEST_OAUTH_CLIENT.clientSecret,
    ...params,
  });
}

async function createPublicClientTokens() {
  const sessionCookie = await createAuthenticatedSession(app);
  const { code } = await getAuthorizationCode(app, {
    sessionCookie,
    clientId: PUBLIC_OAUTH_CLIENT.clientId,
    redirectUri: PUBLIC_OAUTH_CLIENT.redirectUri,
    codeChallenge: TEST_PKCE.codeChallenge,
    codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
  });

  const client = testClient(app);
  const tokenRes = await client.oauth.token.$post({
    form: {
      grant_type: 'authorization_code',
      code,
      client_id: PUBLIC_OAUTH_CLIENT.clientId,
      redirect_uri: PUBLIC_OAUTH_CLIENT.redirectUri,
      code_verifier: TEST_PKCE.codeVerifier,
    },
  });

  return assertJsonBody(tokenRes, 200);
}

describe('POST /oauth/revoke', () => {
  describe('Access Token Revocation', () => {
    test('should revoke valid access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Verify token is active before revocation
      const introspectBefore = await introspectToken(access_token);
      expect((await introspectBefore.json()).active).toBe(true);

      // Revoke the token
      const res = await revokeToken({ token: access_token });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});

      // Verify token is inactive after revocation
      const introspectAfter = await introspectToken(access_token);
      expect((await introspectAfter.json()).active).toBe(false);
    });

    test('should revoke access token with token_type_hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        tokenTypeHint: 'access_token',
      });

      expect(res.status).toBe(200);

      // Verify token is inactive
      const introspectRes = await introspectToken(access_token);
      expect((await introspectRes.json()).active).toBe(false);
    });

    test('should return 200 for already revoked access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Revoke twice
      const res1 = await revokeToken({ token: access_token });
      expect(res1.status).toBe(200);

      const res2 = await revokeToken({ token: access_token });
      expect(res2.status).toBe(200);
    });
  });

  describe('Refresh Token Revocation', () => {
    test('should revoke valid refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Verify token is active before revocation
      const introspectBefore = await introspectToken(refresh_token);
      expect((await introspectBefore.json()).active).toBe(true);

      // Revoke the token
      const res = await revokeToken({ token: refresh_token });

      expect(res.status).toBe(200);

      // Verify token is inactive after revocation
      const introspectAfter = await introspectToken(refresh_token);
      expect((await introspectAfter.json()).active).toBe(false);
    });

    test('should revoke refresh token with token_type_hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      const res = await revokeToken({
        token: refresh_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.status).toBe(200);

      // Verify token is inactive
      const introspectRes = await introspectToken(refresh_token);
      expect((await introspectRes.json()).active).toBe(false);
    });

    test('should prevent token refresh after revocation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Revoke the refresh token
      await revokeToken({ token: refresh_token });

      // Try to use the revoked refresh token
      const refreshRes = await refreshAccessToken(app, {
        refreshToken: refresh_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      const json = await assertJsonBody(refreshRes, 400);
      expect(json.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Invalid Token Handling (RFC 7009 §2.1)', () => {
    test('should return 200 for invalid token string', async () => {
      const res = await revokeToken({
        token: 'invalid-token-string',
      });

      // RFC 7009 §2.1: Returns 200 even for invalid tokens
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    test('should return 200 for malformed JWT', async () => {
      const res = await revokeToken({
        token: 'not.a.valid.jwt.format',
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    test('should return 200 for JWT with invalid signature', async () => {
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const res = await revokeToken({ token: fakeToken });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    test('should reject empty token', async () => {
      const client = testClient(app);
      const res = await client.oauth.revoke.$post({
        form: {
          token: '',
        },
      });

      // Zod validation should fail for empty string
      expect(res.status).toBe(400);
    });
  });

  describe('Client Authentication', () => {
    test('should reject revocation without client identity and leave token active', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.revoke.$post({
        form: {
          token: access_token,
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');

      const introspectRes = await introspectToken(access_token);
      const introspectJson = await assertJsonBody(introspectRes, 200);
      expect(introspectJson.active).toBe(true);
    });

    test('should not revoke another client token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await assertJsonBody(tokenRes, 200);

      const res = await revokeToken({
        token: access_token,
        clientId: PUBLIC_OAUTH_CLIENT.clientId,
      });

      expect(res.status).toBe(200);

      const introspectRes = await introspectToken(access_token);
      const introspectJson = await assertJsonBody(introspectRes, 200);
      expect(introspectJson.active).toBe(true);
    });

    test('should work with valid public client_id without client_secret', async () => {
      const { access_token } = await createPublicClientTokens();

      const res = await revokeToken({
        token: access_token,
        clientId: PUBLIC_OAUTH_CLIENT.clientId,
      });

      expect(res.status).toBe(200);
    });

    test('should reject confidential client revocation without client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.revoke.$post({
        form: {
          token: access_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');

      const introspectRes = await introspectToken(access_token);
      const introspectJson = await assertJsonBody(introspectRes, 200);
      expect(introspectJson.active).toBe(true);
    });

    test('should work with valid client_id and client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.status).toBe(200);
    });

    test('should reject invalid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: 'invalid-client-id',
      });

      const json = await assertJsonBody(res, 400);
      expect(json.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: TEST_OAUTH_CLIENT.clientId,
        clientSecret: 'wrong-secret',
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject malformed Basic auth instead of using body credentials', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.revoke.$post(
        {
          form: {
            token: access_token,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
          },
        },
        {
          headers: {
            Authorization: 'Basic malformed',
          },
        },
      );

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject non-canonical Basic base64 and include a Basic challenge', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const credentials = Buffer.from(
        `${TEST_OAUTH_CLIENT.clientId}:${TEST_OAUTH_CLIENT.clientSecret}`,
        'utf8',
      ).toString('base64');
      const client = testClient(app);
      const res = await client.oauth.revoke.$post(
        {
          form: {
            token: access_token,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
          },
        },
        {
          headers: {
            Authorization: `Basic ${credentials}$$`,
          },
        },
      );

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
      expect(res.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="tinyauth"',
      );
    });

    test('should reject unsupported Authorization schemes instead of using body credentials', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.revoke.$post(
        {
          form: {
            token: access_token,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
          },
        },
        {
          headers: {
            Authorization: 'Bearer access-token',
          },
        },
      );

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
      expect(res.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="tinyauth"',
      );
    });

    test('should reject disabled client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({
        token: access_token,
        clientId: 'disabled-client',
      });

      const json = await assertJsonBody(res, 400);
      expect(['OAUTH_CLIENT_NOT_FOUND', 'OAUTH_CLIENT_DISABLED']).toContain(
        json.code,
      );
    });
  });

  describe('Token Type Hint Handling', () => {
    test('should handle wrong token_type_hint gracefully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Hint says refresh_token but it's actually access_token
      const res = await revokeToken({
        token: access_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.status).toBe(200);

      // Token should still be revoked
      const introspectRes = await introspectToken(access_token);
      expect((await introspectRes.json()).active).toBe(false);
    });

    test('should handle refresh token with access_token hint', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Hint says access_token but it's actually refresh_token
      const res = await revokeToken({
        token: refresh_token,
        tokenTypeHint: 'access_token',
      });

      expect(res.status).toBe(200);

      // Token should still be revoked
      const introspectRes = await introspectToken(refresh_token);
      expect((await introspectRes.json()).active).toBe(false);
    });
  });

  describe('Response Format', () => {
    test('should return empty object on success', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await revokeToken({ token: access_token });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
    });

    test('should return proper error format for client errors', async () => {
      const res = await revokeToken({
        token: 'some-token',
        clientId: 'invalid-client',
      });

      const json = await assertJsonBody(res, 400);
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(typeof json.code).toBe('string');
      expect(typeof json.message).toBe('string');
    });
  });

  describe('Integration with Other Endpoints', () => {
    test('revoked access token should fail userinfo request', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Revoke the access token
      await revokeToken({ token: access_token });

      // Try to use the revoked token for userinfo
      const userinfoRes = await getUserInfo(app, access_token);

      expect(userinfoRes.status).toBe(401);
    });

    test('revoked token should show as inactive in introspection', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token, refresh_token } = await tokenRes.json();

      // Revoke both tokens
      await revokeToken({ token: access_token });
      await revokeToken({ token: refresh_token });

      // Both should show as inactive
      const accessIntrospect = await introspectToken(access_token);
      const refreshIntrospect = await introspectToken(refresh_token);

      expect((await accessIntrospect.json()).active).toBe(false);
      expect((await refreshIntrospect.json()).active).toBe(false);
    });
  });

  describe('Request Validation', () => {
    test('should reject request without token field', async () => {
      const client = testClient(app);
      const res = await client.oauth.revoke.$post({
        // @ts-expect-error testing validation with missing required field
        form: {
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      expect(res.status).toBe(400);
    });

    test('should handle very long token gracefully', async () => {
      const longToken = 'a'.repeat(10000);

      const res = await revokeToken({ token: longToken });

      // RFC 7009 says to return 200 even for invalid tokens
      expect(res.status).toBe(200);
    });

    test('should handle special characters in token gracefully', async () => {
      const specialToken = 'token<script>alert(1)</script>token';

      const res = await revokeToken({ token: specialToken });

      expect(res.status).toBe(200);
    });
  });

  describe('Idempotency', () => {
    test('should be idempotent for same token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Revoke multiple times
      const res1 = await revokeToken({ token: access_token });
      const res2 = await revokeToken({ token: access_token });
      const res3 = await revokeToken({ token: access_token });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // Token should still be inactive
      const introspectRes = await introspectToken(access_token);
      expect((await introspectRes.json()).active).toBe(false);
    });
  });
});
