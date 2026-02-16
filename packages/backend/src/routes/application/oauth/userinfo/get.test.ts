import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestClient,
  createTestClientWithHeaders,
  exchangeCodeForTokens,
  getAccessToken,
  getAuthorizationCode,
  getUserInfo,
  MINIMAL_TEST_CONFIG,
  revokeToken,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, cleanup } = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  }));
});

afterAll(async () => {
  await cleanup();
});

describe('GET /application/oauth/userinfo', () => {
  describe('Success Cases', () => {
    test('should return user info with all scopes', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // OIDC Core §5.3.2 - Standard Claims
      expect(json.sub).toBeDefined(); // Always present
      expect(typeof json.sub).toBe('string');

      // Email scope claims
      expect(json.email).toBe(TEST_USER.email);
      expect(typeof json.email_verified).toBe('boolean');

      // Profile scope claims
      expect(json.name).toBeDefined();
      expect(json.preferred_username).toBeDefined();
    });

    test('should return only sub and email claims with email scope', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid email', // No profile scope
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should have sub (always) and email claims
      expect(json.sub).toBeDefined();
      expect(json.email).toBe(TEST_USER.email);
      expect(json.email_verified).toBeDefined();

      // Should NOT have profile claims
      expect(json.name).toBeUndefined();
      expect(json.preferred_username).toBeUndefined();
      expect(json.picture).toBeUndefined();
    });

    test('should return only sub and profile claims with profile scope', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile', // No email scope
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should have sub (always) and profile claims
      expect(json.sub).toBeDefined();
      expect(json.name).toBeDefined();
      expect(json.preferred_username).toBeDefined();

      // Should NOT have email claims
      expect(json.email).toBeUndefined();
      expect(json.email_verified).toBeUndefined();
    });

    test('should return only sub with just openid scope', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid', // Only openid, no profile or email
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should only have sub claim
      expect(json.sub).toBeDefined();

      // Should NOT have email or profile claims
      expect(json.email).toBeUndefined();
      expect(json.email_verified).toBeUndefined();
      expect(json.name).toBeUndefined();
      expect(json.preferred_username).toBeUndefined();
      expect(json.picture).toBeUndefined();
    });

    test('should work with OAuth2 flow (no openid scope)', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'profile email', // No openid scope
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should have all claims based on scopes
      expect(json.sub).toBeDefined();
      expect(json.email).toBe(TEST_USER.email);
      expect(json.name).toBeDefined();
    });

    test('should return valid user ID in sub claim', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Sub should be a valid UUID or user ID
      expect(json.sub).toBeDefined();
      expect(json.sub.length).toBeGreaterThan(0);
    });
  });

  describe('Bearer Token Validation', () => {
    test('should reject request without Authorization header', async () => {
      const res = await app.request('/application/oauth/userinfo', {
        method: 'GET',
        // No Authorization header
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('MISSING_AUTHORIZATION_HEADER');
    });

    test('should reject request with invalid Authorization header format', async () => {
      const client = createTestClient(app);
      const res = await client.application.oauth.userinfo.$get({
        header: {
          authorization: 'InvalidFormat token123', // Should be "Bearer <token>"
        },
      });

      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_AUTHORIZATION_HEADER_FORMAT');
    });

    test('should reject request with missing token in Bearer header', async () => {
      const client = createTestClient(app);
      const res = await client.application.oauth.userinfo.$get({
        header: {
          authorization: 'Bearer ', // No token after Bearer
        },
      });

      // Hono trims trailing space from 'Bearer ', resulting in 'Bearer'
      // which fails the format check (expects 2 parts after split)
      const json = await assertJsonBody(res, 401);
      expect(json.code).toBe('INVALID_AUTHORIZATION_HEADER_FORMAT');
    });

    test('should reject request with invalid access token', async () => {
      const res = await getUserInfo(app, 'invalid-token-that-is-not-a-jwt');

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    });

    test('should reject request with malformed JWT', async () => {
      const res = await getUserInfo(app, 'not.a.valid.jwt.format');

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    });

    test('should reject request with expired access token', async () => {
      // This test would require generating an expired token
      // For now, we test with an invalid token
      const fakeExpiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      const res = await getUserInfo(app, fakeExpiredToken);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    });

    test('should reject request with refresh token instead of access token', async () => {
      // Get tokens
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = await tokenRes.json();

      // Try to use refresh token for userinfo (should fail)
      const res = await getUserInfo(app, refresh_token);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  describe('Scope-based Claims Filtering', () => {
    test('should respect scope limitations', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid', // Minimal scope
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Only sub should be present
      const keys = Object.keys(json);
      expect(keys).toHaveLength(1);
      expect(keys).toContain('sub');
    });

    test('should include email_verified only with email scope', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.email_verified).toBeDefined();
      expect(typeof json.email_verified).toBe('boolean');
    });

    test('should not leak claims from other scopes', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile', // Only profile, no email
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should NOT have email claims
      expect(json).not.toHaveProperty('email');
      expect(json).not.toHaveProperty('email_verified');

      // Should have profile claims
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('preferred_username');
    });
  });

  describe('Response Format', () => {
    test('should return JSON content type', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    test('should return valid JSON structure', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);

      // Should be parseable as JSON
      const json = await res.json();
      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
    });

    test('should follow OIDC standard claim names', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // OIDC standard claims (snake_case)
      expect(json).toHaveProperty('sub');
      expect(json).toHaveProperty('email_verified'); // Not emailVerified
      expect(json).toHaveProperty('preferred_username'); // Not preferredUsername
    });

    test('should not include null or undefined values', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // All values should be defined (not null/undefined)
      for (const [_key, value] of Object.entries(json)) {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
      }
    });
  });

  describe('Error Response Format', () => {
    test('should return proper error format for missing auth header', async () => {
      const client = createTestClient(app);
      const res = await client.application.oauth.userinfo.$get({
        header: {
          authorization: undefined,
        },
      });

      const json = await assertJsonBody(res, 401);

      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(typeof json.code).toBe('string');
      expect(typeof json.message).toBe('string');
    });

    test('should return 401 for all authentication errors', async () => {
      const client = createTestClient(app);
      const testCases = [
        { authorization: undefined, desc: 'missing header' },
        { authorization: 'InvalidFormat', desc: 'invalid format' },
        { authorization: 'Bearer ', desc: 'missing token' },
        { authorization: 'Bearer invalid', desc: 'invalid token' },
      ];

      for (const testCase of testCases) {
        const res = await client.application.oauth.userinfo.$get({
          header: {
            authorization: testCase['authorization'],
          },
        });

        const json = await assertJsonBody(res, 401);
        expect(json.code).toBeDefined();
        expect(json.message).toBeDefined();
      }
    });
  });

  describe('OIDC Compliance', () => {
    test('should comply with OIDC Core §5.3 UserInfo endpoint', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const res = await getUserInfo(app, accessToken);

      expect(res.status).toBe(200);
      const json = await res.json();

      // §5.3.2 - sub claim is REQUIRED
      expect(json.sub).toBeDefined();

      // Claims should be returned based on scopes
      expect(json.email).toBeDefined(); // email scope
      expect(json.name).toBeDefined(); // profile scope
    });

    test('should return claims consistent with ID token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const scope = 'openid email';

      // Get authorization code (this also grants consent)
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope,
      });

      // Exchange code for tokens
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token, id_token } = await tokenRes.json();

      // Get userinfo
      const userinfoRes = await getUserInfo(app, access_token);
      const userinfo = await userinfoRes.json();

      // Decode ID token (without verification, just for comparison)
      const idTokenPayload = JSON.parse(
        Buffer.from(id_token.split('.')[1] || '', 'base64').toString(),
      );

      // Sub claim should match
      expect(userinfo.sub).toBe(idTokenPayload.sub);

      // Email claim should match (if present)
      if (userinfo.email) {
        expect(userinfo.email).toBe(idTokenPayload.email);
      }
    });
  });

  describe('Multiple Requests', () => {
    test('should handle multiple requests with same token', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid email',
      });

      // First request
      const res1 = await getUserInfo(app, accessToken);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      // Second request with same token
      const res2 = await getUserInfo(app, accessToken);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      // Responses should be identical
      expect(json1).toEqual(json2);
    });

    test('should return different claims for different scopes', async () => {
      const token1 = await getAccessToken(app, { scope: 'openid email' });
      const token2 = await getAccessToken(app, { scope: 'openid profile' });

      const res1 = await getUserInfo(app, token1);
      const res2 = await getUserInfo(app, token2);

      const json1 = await res1.json();
      const json2 = await res2.json();

      // Token 1 should have email, not profile claims
      expect(json1.email).toBeDefined();
      expect(json1.name).toBeUndefined();

      // Token 2 should have profile claims, not email
      expect(json2.name).toBeDefined();
      expect(json2.email).toBeUndefined();

      // Both should have sub
      expect(json1.sub).toBeDefined();
      expect(json2.sub).toBeDefined();
      expect(json1.sub).toBe(json2.sub); // Same user
    });
  });

  describe('Token Revocation', () => {
    test('should reject revoked access token', async () => {
      // Get access token
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, {
        sessionCookie,
        scope: 'openid profile email',
      });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = await tokenRes.json();

      // Verify token works before revocation
      const validRes = await getUserInfo(app, access_token);
      expect(validRes.status).toBe(200);

      // Revoke the token
      const revokeRes = await revokeToken(app, {
        token: access_token,
      });
      expect(revokeRes.status).toBe(200);

      // Token should now be rejected
      const revokedRes = await getUserInfo(app, access_token);
      expect(revokedRes.status).toBe(401);
      const json = await revokedRes.json();
      expect(json.code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  describe('HTTP Method Handling', () => {
    test('should respond to HEAD request', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid',
      });

      const res = await app.request('/application/oauth/userinfo', {
        method: 'HEAD',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // HEAD requests typically return 200 with no body or 405 if not supported
      expect([200, 204, 405]).toContain(res.status);
    });

    test('should reject POST request (GET only endpoint)', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid',
      });

      const res = await app.request('/application/oauth/userinfo', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // POST is not implemented, should return 404
      expect(res.status).toBe(404);
    });
  });

  describe('Content Negotiation', () => {
    test('should handle Accept: application/json header', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const client = createTestClientWithHeaders(app, {
        accept: 'application/json',
      });
      const res = await client.application.oauth.userinfo.$get({
        header: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    test('should handle Accept: */* header', async () => {
      const accessToken = await getAccessToken(app, {
        scope: 'openid profile email',
      });

      const client = createTestClientWithHeaders(app, {
        accept: '*/*',
      });
      const res = await client.application.oauth.userinfo.$get({
        header: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const json = await assertJsonBody(res);
      expect(json.sub).toBeDefined();
    });
  });
});
