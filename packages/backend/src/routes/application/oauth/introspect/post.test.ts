import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  exchangeCodeForTokens,
  getAuthorizationCode,
  introspectToken,
  setupTestServer,
  TEST_OAUTH_CLIENT,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /application/oauth/introspect', () => {
  describe('Valid Token Introspection - Access Token', () => {
    test('should return active=true for valid access token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.active).toBe(true);
      expect(json.scope).toBe('openid profile email');
      expect(json.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(json.token_type).toBe('Bearer');
      expect(json.exp).toBeDefined();
      expect(json.iat).toBeDefined();
      expect(json.sub).toBeDefined();
      expect(json.iss).toBeDefined();
    });

    test('should work with token_type_hint=access_token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        tokenTypeHint: 'access_token',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(true);
    });

    test('should work without client_id and client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/introspect',
        payload: {
          token: access_token,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(true);
    });

    test('should work with client_secret authentication', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientSecret: TEST_OAUTH_CLIENT.clientSecret,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(true);
    });
  });

  describe('Valid Token Introspection - Refresh Token', () => {
    test('should return active=true for valid refresh token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      const res = await introspectToken(app, { token: refresh_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.active).toBe(true);
      expect(json.scope).toBe('openid profile email');
      expect(json.client_id).toBe(TEST_OAUTH_CLIENT.clientId);
      expect(json.token_type).toBe('Bearer');
      expect(json.exp).toBeDefined();
      expect(json.iat).toBeDefined();
      expect(json.sub).toBeDefined();
      expect(json.iss).toBeDefined();
    });

    test('should work with token_type_hint=refresh_token', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { refresh_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: refresh_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(true);
    });
  });

  describe('Invalid Token Introspection', () => {
    test('should return active=false for invalid token', async () => {
      const res = await introspectToken(app, {
        token: 'invalid-token-that-is-not-a-jwt',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

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

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(false);
    });

    test('should return active=false for JWT with invalid signature', async () => {
      // Use a valid JWT structure but from a different server
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const res = await introspectToken(app, { token: fakeToken });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(false);
    });

    test('should return active=false for empty token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/application/oauth/introspect',
        payload: {
          token: '',
        },
      });

      // Zod validation should fail for empty string
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Token Type Hint', () => {
    test('should handle wrong token_type_hint gracefully', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      // Hint says refresh_token but it's actually access_token
      const res = await introspectToken(app, {
        token: access_token,
        tokenTypeHint: 'refresh_token',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      // Should still verify correctly (fallback to trying both types)
      expect(json.active).toBe(true);
    });
  });

  describe('Client Authentication', () => {
    test('should reject invalid client_id', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientId: 'invalid-client-id',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });

    test('should reject invalid client_secret', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientSecret: 'wrong-secret',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('INVALID_CLIENT_CREDENTIALS');
    });

    test('should reject disabled client', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenRes = await exchangeCodeForTokens(app, { code });
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, {
        token: access_token,
        clientId: 'disabled-client',
      });

      // Will fail at client lookup or disabled check
      expect(res.statusCode).toBe(400);
      const json = res.json();
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
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();

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

      expect(res.statusCode).toBe(200);
      const json = res.json();

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
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();
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
      const { access_token } = tokenRes.json();

      const res = await introspectToken(app, { token: access_token });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.active).toBe(true);
      expect(json.scope).toBe('profile email');
    });
  });
});
