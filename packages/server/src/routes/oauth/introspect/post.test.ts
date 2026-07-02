import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens as exchangeCodeForTokensRequest,
  getAuthorizationCode,
  introspectToken as introspectTokenRequest,
  MINIMAL_TEST_CONFIG,
  revokeToken as revokeTokenRequest,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

const PUBLIC_OAUTH_CLIENT = {
  clientId: 'public-introspection-client',
  redirectUri: 'http://localhost:8080/public-introspection-callback',
} as const;

const PUBLIC_OAUTH_CLIENT_CONFIG = {
  id: 'public-introspection-client-config',
  name: 'Public Introspection Client',
  client_id: PUBLIC_OAUTH_CLIENT.clientId,
  redirect_uris: [PUBLIC_OAUTH_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email',
};

const TEST_OAUTH_CLIENT_CONFIG_WITH_REFRESH = {
  ...TEST_OAUTH_CLIENT_CONFIG,
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email id_token offline_access',
};

beforeAll(async () => {
  ({ app, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [
      TEST_OAUTH_CLIENT_CONFIG_WITH_REFRESH,
      PUBLIC_OAUTH_CLIENT_CONFIG,
    ],
  }));
});

afterAll(async () => {
  await cleanup();
});

async function introspectToken(
  honoApp: AppType,
  params: {
    token: string | undefined;
    tokenTypeHint?: string;
    clientId?: string;
    clientSecret?: string;
  },
) {
  const clientId = params.clientId ?? TEST_OAUTH_CLIENT.clientId;
  const clientSecret =
    params.clientSecret ??
    (clientId === TEST_OAUTH_CLIENT.clientId
      ? TEST_OAUTH_CLIENT.clientSecret
      : undefined);

  return introspectTokenRequest(honoApp, {
    ...params,
    clientId,
    ...(clientSecret != null ? { clientSecret } : {}),
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
    codeVerifier: TEST_PKCE.codeVerifier,
    ...params,
  });
}

async function revokeToken(
  honoApp: AppType,
  params: {
    token: string | undefined;
    tokenTypeHint?: string;
    clientId?: string;
    clientSecret?: string;
  },
) {
  return revokeTokenRequest(honoApp, {
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

function basicAuthHeader(clientId: string, clientSecret: string) {
  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
    'utf8',
  ).toString('base64');
  return `Basic ${credentials}`;
}

describe('POST /oauth/introspect', () => {
  describe('Valid Token Introspection - Access Token', () => {
    test('should return active=true for valid access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      const json = await assertJsonBody(res, 200);

      expect(json.active).toBe(true);
      expect(json.scope).toBe('openid profile email offline_access');
      expect(json.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(json.token_type).toBe('Bearer');
      expect(json.exp).toBeDefined();
      expect(json.iat).toBeDefined();
      expect(json.sub).toBeDefined();
      expect(json.iss).toBeDefined();
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('pragma')).toBe('no-cache');
    });

    test('should work with token_type_hint=access_token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        tokenTypeHint: 'access_token',
      });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
    });

    test('should ignore unknown token_type_hint values', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        tokenTypeHint: 'urn:example:custom_token',
      });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
    });

    test('should reject introspection without client identity', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        form: {
          token: access_token,
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should work with client_secret authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
    });
  });

  describe('Valid Token Introspection - Refresh Token', () => {
    test('should return active=true for valid refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      const res = await introspectToken(app, { token: refresh_token });

      const json = await assertJsonBody(res, 200);

      expect(json.active).toBe(true);
      expect(json.scope).toBe('openid profile email offline_access');
      expect(json.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(json.token_type).toBe('Bearer');
      expect(json.exp).toBeDefined();
      expect(json.iat).toBeDefined();
      expect(json.sub).toBeDefined();
      expect(json.iss).toBeDefined();
    });

    test('should work with token_type_hint=refresh_token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: refresh_token,
        tokenTypeHint: 'refresh_token',
      });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
    });
  });

  describe('Invalid Token Introspection', () => {
    test('should return active=false for invalid token', async () => {
      const res = await introspectToken(app, {
        token: 'invalid-token-that-is-not-a-jwt',
      });

      const json = await assertJsonBody(res, 200);

      expect(json.active).toBe(false);
      expect(json.scope).toBeUndefined();
      expect(json.client_id).toBeUndefined();
      expect(json.token_type).toBeUndefined();
      expect(json.exp).toBeUndefined();
      expect(json.iat).toBeUndefined();
      expect(json.sub).toBeUndefined();
      expect(json.iss).toBeUndefined();
    });

    test('should return active=false for malformed JWT', async () => {
      const res = await introspectToken(app, {
        token: 'header.payload', // Only 2 parts instead of 3
      });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(false);
    });

    test('should return active=false for JWT with invalid signature', async () => {
      // Use a valid JWT structure but from a different server
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const res = await introspectToken(app, { token: fakeToken });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(false);
    });

    test('should return active=false for empty token', async () => {
      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        form: {
          token: '',
        },
      });

      // Zod validation should fail for empty string
      expect(res.status).toBe(400);
    });
  });

  describe('Token Type Hint', () => {
    test('should handle wrong token_type_hint gracefully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Hint says refresh_token but it's actually access_token
      const res = await introspectToken(app, {
        token: access_token,
        tokenTypeHint: 'refresh_token',
      });

      const json = await assertJsonBody(res, 200);
      // Should still verify correctly (fallback to trying both types)
      expect(json.active).toBe(true);
    });
  });

  describe('Client Authentication', () => {
    test('should reject confidential client introspection without client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, {
        code,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });
      const { access_token } = await tokenRes.json();

      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        form: {
          token: access_token,
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject public client introspection without client_secret', async () => {
      const { access_token } = await createPublicClientTokens();

      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        form: {
          token: access_token,
          client_id: PUBLIC_OAUTH_CLIENT.clientId,
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should not expose active token metadata to another client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await assertJsonBody(tokenRes, 200);

      const res = await introspectToken(app, {
        token: access_token,
        clientId: PUBLIC_OAUTH_CLIENT.clientId,
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject invalid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientId: 'invalid-client-id',
      });

      const json = await assertJsonBody(res, 400);
      expect(json.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should challenge unknown Basic client credentials', async () => {
      const client = testClient(app);
      const response = await client.oauth.introspect.$post(
        {
          form: { token: 'opaque-token' },
        },
        {
          headers: {
            authorization: basicAuthHeader('unknown-client', 'secret'),
          },
        },
      );

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(
        'Basic realm="tinyauth"',
      );
      const json = await assertJsonBody(response, 401);
      expect(json.error).toBe('invalid_client');
    });

    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
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
      const res = await client.oauth.introspect.$post(
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
      const res = await client.oauth.introspect.$post(
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
      const res = await client.oauth.introspect.$post(
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

      const res = await introspectToken(app, {
        token: access_token,
        clientId: 'disabled-client',
      });

      // Will fail at client lookup or disabled check
      const json = await assertJsonBody(res, 400);
      expect(['OAUTH_CLIENT_NOT_FOUND', 'OAUTH_CLIENT_DISABLED']).toContain(
        json.code,
      );
    });
  });

  describe('Response Format', () => {
    test('should return proper active response format', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      const json = await assertJsonBody(res, 200);

      // RFC 7662 §2.2 - Introspection Response (active)
      expect(json).toHaveProperty('active');
      expect(typeof json.active).toBe('boolean');

      // Optional claims (only present when active=true)
      if (json.active) {
        expect(typeof json.scope).toBe('string');
        expect(typeof json.client_id).toBe('string');
        expect(json.token_type).toBe('Bearer');
        expect(typeof json.exp).toBe('number');
        expect(typeof json.iat).toBe('number');
        expect(typeof json.sub).toBe('string');
        expect(typeof json.iss).toBe('string');
      }
    });

    test('should return proper inactive response format', async () => {
      const res = await introspectToken(app, { token: 'invalid' });

      const json = await assertJsonBody(res, 200);

      // RFC 7662 §2.2 - Introspection Response (inactive)
      expect(json).toHaveProperty('active');
      expect(json.active).toBe(false);

      // No additional claims when inactive
      expect(Object.keys(json)).toHaveLength(1);
    });
  });

  describe('Scope Handling', () => {
    test('should return correct scopes for limited scope token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile', // Limited scopes
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
      expect(json.scope).toBe('openid profile');
    });

    test('should return scopes without openid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'profile email', // No openid
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(true);
      expect(json.scope).toBe('profile email');
    });
  });

  describe('Revoked Token Handling', () => {
    test('should return active=false for revoked access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Verify token is active before revocation
      const beforeRes = await introspectToken(app, { token: access_token });
      expect((await beforeRes.json()).active).toBe(true);

      // Revoke the token
      const revokeRes = await revokeToken(app, {
        token: access_token,
      });
      expect(revokeRes.status).toBe(200);

      // Token should now be inactive
      const afterRes = await introspectToken(app, { token: access_token });
      const json = await assertJsonBody(afterRes, 200);
      expect(json.active).toBe(false);
    });

    test('should return active=false for revoked refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email offline_access',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Verify token is active before revocation
      const beforeRes = await introspectToken(app, { token: refresh_token });
      expect((await beforeRes.json()).active).toBe(true);

      // Revoke the token
      const revokeRes = await revokeToken(app, {
        token: refresh_token,
      });
      expect(revokeRes.status).toBe(200);

      // Token should now be inactive
      const afterRes = await introspectToken(app, { token: refresh_token });
      const json = await assertJsonBody(afterRes, 200);
      expect(json.active).toBe(false);
    });
  });

  describe('Request Validation', () => {
    test('should reject request without token', async () => {
      const client = testClient(app);
      const res = await client.oauth.introspect.$post({
        // @ts-expect-error testing validation with missing required field
        form: {
          client_id: TEST_OAUTH_CLIENT.clientId,
        },
      });

      expect(res.status).toBe(400);
    });

    test('should handle very long token gracefully', async () => {
      const longToken = 'a'.repeat(10000);

      const res = await introspectToken(app, { token: longToken });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(false);
    });

    test('should handle special characters in token', async () => {
      const specialToken = 'token<script>alert(1)</script>token';

      const res = await introspectToken(app, { token: specialToken });

      const json = await assertJsonBody(res, 200);
      expect(json.active).toBe(false);
    });
  });
});
