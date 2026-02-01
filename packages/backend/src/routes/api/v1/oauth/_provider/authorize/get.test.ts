import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  expectError,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      oauth_authentication_methods: [
        {
          id: 'google',
          type: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        },
        {
          id: 'github',
          type: 'github',
          enabled: false,
          display_name: 'GitHub',
          client_id: 'test-github-client-id',
          client_secret: 'test-github-client-secret',
          email_conflict_strategy: 'auto_link',
        },
      ],
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/oauth/:provider/authorize', () => {
  describe('Success Cases', () => {
    test('should redirect to OAuth provider with valid provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBeDefined();

      const location = new URL(res.headers.location as string);

      // Should redirect to Google OAuth
      expect(location.origin).toBe('https://accounts.google.com');
      expect(location.pathname).toBe('/o/oauth2/v2/auth');

      // Should have required OAuth parameters
      expect(location.searchParams.get('client_id')).toBe(
        'test-google-client-id',
      );
      expect(location.searchParams.get('response_type')).toBe('code');
      expect(location.searchParams.get('redirect_uri')).toContain(
        '/api/v1/oauth/google/callback',
      );

      // Should have PKCE parameters
      expect(location.searchParams.get('code_challenge')).toBeDefined();
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');

      // Should have state for CSRF protection
      expect(location.searchParams.get('state')).toBeDefined();

      // Should have scopes
      expect(location.searchParams.get('scope')).toBeDefined();
    });

    test('should store session data with state and code verifier', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      expect(res.statusCode).toBe(302);

      // Session cookie should be set
      const sessionCookie = res.cookies.find((c) => c.name === 'session');
      expect(sessionCookie).toBeDefined();
    });

    test('should support login mode (default)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'login',
        },
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBeDefined();
    });

    test('should support register mode', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'register',
        },
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBeDefined();
    });

    test('should support link mode with authenticated session', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'link',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBeDefined();
    });

    test('should preserve return_url parameter', async () => {
      const returnUrl = '/profile?tab=oauth';

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'login',
          return_url: returnUrl,
        },
      });

      expect(res.statusCode).toBe(302);
      // return_url is stored in session, not in redirect URL
    });

    test('should generate unique state for each request', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      const location1 = new URL(res1.headers.location as string);
      const location2 = new URL(res2.headers.location as string);

      const state1 = location1.searchParams.get('state');
      const state2 = location2.searchParams.get('state');

      expect(state1).not.toBe(state2);
    });

    test('should generate unique code_challenge for each request', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      const location1 = new URL(res1.headers.location as string);
      const location2 = new URL(res2.headers.location as string);

      const challenge1 = location1.searchParams.get('code_challenge');
      const challenge2 = location2.searchParams.get('code_challenge');

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('Provider Validation', () => {
    test('should return 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/nonexistent/authorize',
      });

      expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for disabled provider', async () => {
      // GitHub is disabled in test config
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/github/authorize',
      });

      expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for invalid provider id format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/invalid-provider-123/authorize',
      });

      expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Mode Validation', () => {
    test('should reject invalid mode parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'invalid_mode',
        },
      });

      // Zod validation should fail
      expect(res.statusCode).toBe(400);
    });

    test('should use login as default mode when not specified', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      expect(res.statusCode).toBe(302);
      // Mode is stored in session, verify redirect happens
      expect(res.headers.location).toBeDefined();
    });
  });

  describe('Link Mode Authentication', () => {
    test('should return 401 for link mode without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
        query: {
          mode: 'link',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Security', () => {
    test('should use S256 for PKCE code challenge method', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/oauth/google/authorize',
      });

      const location = new URL(res.headers.location as string);
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    });

    test('should generate cryptographically random state', async () => {
      const states: string[] = [];

      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/oauth/google/authorize',
        });

        const location = new URL(res.headers.location as string);
        const state = location.searchParams.get('state');
        expect(state).toBeDefined();
        states.push(state as string);
      }

      // All states should be unique
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(5);

      // States should be UUID format
      for (const state of states) {
        expect(state).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });
  });
});
