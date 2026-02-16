import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import {
  createAuthenticatedSession,
  createTestClient,
  createTestClientWithHeaders,
  expectError,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      identity_providers: [
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
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/v1/oauth/:provider/authorize', () => {
  describe('Success Cases', () => {
    test('should redirect to OAuth provider with valid provider', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();

      const location = new URL(res.headers.get('location') as string);

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
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      expect(res.status).toBe(302);

      // Session cookie should be set
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('session=');
    });

    test('should support login mode (default)', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'login' },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should support register mode', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'register' },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should support link mode with authenticated session', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const client = createTestClientWithHeaders(app, {
        Cookie: `session=${sessionCookie}`,
      });
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'link' },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should preserve return_url parameter', async () => {
      const returnUrl = '/profile?tab=oauth';

      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {
          mode: 'login',
          return_url: returnUrl,
        },
      });

      expect(res.status).toBe(302);
      // return_url is stored in session, not in redirect URL
    });

    test('should generate unique state for each request', async () => {
      const client = createTestClient(app);

      const res1 = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const res2 = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location1 = new URL(res1.headers.get('location') as string);
      const location2 = new URL(res2.headers.get('location') as string);

      const state1 = location1.searchParams.get('state');
      const state2 = location2.searchParams.get('state');

      expect(state1).not.toBe(state2);
    });

    test('should generate unique code_challenge for each request', async () => {
      const client = createTestClient(app);

      const res1 = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const res2 = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location1 = new URL(res1.headers.get('location') as string);
      const location2 = new URL(res2.headers.get('location') as string);

      const challenge1 = location1.searchParams.get('code_challenge');
      const challenge2 = location2.searchParams.get('code_challenge');

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('Provider Validation', () => {
    test('should return 404 for non-existent provider', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'nonexistent' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for disabled provider', async () => {
      // GitHub is disabled in test config
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'github' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for invalid provider id format', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'invalid-provider-123' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Mode Validation', () => {
    test('should reject invalid mode parameter', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'invalid_mode' },
      });

      // Zod validation should fail
      expect(res.status).toBe(400);
    });

    test('should use login as default mode when not specified', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      expect(res.status).toBe(302);
      // Mode is stored in session, verify redirect happens
      expect(res.headers.get('location')).toBeDefined();
    });
  });

  describe('Link Mode Authentication', () => {
    test('should return 401 for link mode without authentication', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'link' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Security', () => {
    test('should use S256 for PKCE code challenge method', async () => {
      const client = createTestClient(app);
      const res = await client.api.v1.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location = new URL(res.headers.get('location') as string);
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    });

    test('should generate cryptographically random state', async () => {
      const client = createTestClient(app);
      const states: string[] = [];

      for (let i = 0; i < 5; i++) {
        const res = await client.api.v1.oauth[':provider'].authorize.$get({
          param: { provider: 'google' },
          query: {},
        });

        const location = new URL(res.headers.get('location') as string);
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
