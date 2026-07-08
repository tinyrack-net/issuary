import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../../entrypoints/app.ts';
import { apple } from '../../../../../entrypoints/identity-providers/apple.ts';
import { github } from '../../../../../entrypoints/identity-providers/github.ts';
import { google } from '../../../../../entrypoints/identity-providers/google.ts';
import { e } from '../../../../../schemas/error.ts';
import {
  createAuthenticatedSession,
  createTestApp,
  expectError,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      github({
        id: 'github',
        enabled: true,
        display_name: 'GitHub',
        client_id: 'test-github-client-id',
        client_secret: 'test-github-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      apple({
        id: 'apple',
        enabled: true,
        display_name: 'Apple',
        client_id: 'test-apple-client-id',
        client_secret: 'test-apple-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      github({
        id: 'disabled-github',
        enabled: false,
        display_name: 'Disabled GitHub',
        client_id: 'test-disabled-github-client-id',
        client_secret: 'test-disabled-github-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/oauth/:provider/authorize', () => {
  describe('Success Cases', () => {
    test('should redirect to OAuth provider with valid provider', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();

      const location = new URL(getLocationHeader(res));

      // Should redirect to Google OAuth
      expect(location.origin).toBe('https://accounts.google.com');
      expect(location.pathname).toBe('/o/oauth2/v2/auth');

      // Should have required OAuth parameters
      expect(location.searchParams.get('client_id')).toBe(
        'test-google-client-id',
      );
      expect(location.searchParams.get('response_type')).toBe('code');
      expect(location.searchParams.get('redirect_uri')).toContain(
        '/api/oauth/google/callback',
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
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
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
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'login' },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should support register mode', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'register' },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should support link mode with authenticated session', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get(
        {
          param: { provider: 'google' },
          query: { mode: 'link' },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();
    });

    test('should preserve return_url parameter', async () => {
      const returnUrl = '/profile?tab=oauth';

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
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
      const client = testClient(app);

      const res1 = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const res2 = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location1 = new URL(getLocationHeader(res1));
      const location2 = new URL(getLocationHeader(res2));

      const state1 = location1.searchParams.get('state');
      const state2 = location2.searchParams.get('state');

      expect(state1).not.toBe(state2);
    });

    test('should generate unique code_challenge for each request', async () => {
      const client = testClient(app);

      const res1 = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const res2 = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location1 = new URL(getLocationHeader(res1));
      const location2 = new URL(getLocationHeader(res2));

      const challenge1 = location1.searchParams.get('code_challenge');
      const challenge2 = location2.searchParams.get('code_challenge');

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('Provider Validation', () => {
    test('should return 404 for non-existent provider', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'nonexistent' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for disabled provider', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'disabled-github' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });

    test('should return 404 for invalid provider id format', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'invalid-provider-123' },
        query: {},
      });

      await expectError(res, e.OAuthProviderNotFound);
    });
  });

  describe('Mode Validation', () => {
    test('should reject invalid mode parameter', async () => {
      const res = await app.request(
        '/api/oauth/google/authorize?mode=invalid_mode',
      );

      // Zod validation should fail
      expect(res.status).toBe(400);
    });

    test('should use login as default mode when not specified', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
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
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: { mode: 'link' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Security', () => {
    test('should reject external absolute return_url', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {
          return_url: 'https://evil.example/phish',
        },
      });

      expect(res.status).toBe(400);
    });

    test('should reject protocol-relative return_url', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {
          return_url: '//evil.example/phish',
        },
      });

      expect(res.status).toBe(400);
    });

    test('should reject return_url containing CRLF', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {
          return_url: '/profile\r\nSet-Cookie: session=attacker',
        },
      });

      expect(res.status).toBe(400);
    });

    test('should use S256 for PKCE code challenge method', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'google' },
        query: {},
      });

      const location = new URL(getLocationHeader(res));
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    });

    test('should generate cryptographically random state', async () => {
      const client = testClient(app);
      const states: string[] = [];

      for (let i = 0; i < 5; i++) {
        const res = await client.api.oauth[':provider'].authorize.$get({
          param: { provider: 'google' },
          query: {},
        });

        const location = new URL(getLocationHeader(res));
        const state = location.searchParams.get('state');
        if (!state) {
          throw new Error('Expected state parameter in redirect');
        }
        states.push(state);
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

  describe('GitHub Provider', () => {
    test('should redirect to GitHub authorization URL', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'github' },
        query: {},
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res));

      expect(location.origin).toBe('https://github.com');
      expect(location.pathname).toBe('/login/oauth/authorize');
      expect(location.searchParams.get('client_id')).toBe(
        'test-github-client-id',
      );
    });

    test('should use user:email scope for GitHub', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'github' },
        query: {},
      });

      const location = new URL(getLocationHeader(res));
      expect(location.searchParams.get('scope')).toBe('user:email');
    });

    test('should not include response_mode for GitHub', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'github' },
        query: {},
      });

      const location = new URL(getLocationHeader(res));
      expect(location.searchParams.get('response_mode')).toBeNull();
    });
  });

  describe('Apple Provider', () => {
    test('should redirect to Apple authorization URL', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'apple' },
        query: {},
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res));

      expect(location.origin).toBe('https://appleid.apple.com');
      expect(location.pathname).toBe('/auth/authorize');
      expect(location.searchParams.get('client_id')).toBe(
        'test-apple-client-id',
      );
    });

    test('should include response_mode=form_post for Apple', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'apple' },
        query: {},
      });

      const location = new URL(getLocationHeader(res));
      expect(location.searchParams.get('response_mode')).toBe('form_post');
    });

    test('should use openid email name scopes for Apple', async () => {
      const client = testClient(app);
      const res = await client.api.oauth[':provider'].authorize.$get({
        param: { provider: 'apple' },
        query: {},
      });

      const location = new URL(getLocationHeader(res));
      const scopes = location.searchParams.get('scope')?.split(' ') ?? [];
      expect(scopes).toContain('openid');
      expect(scopes).toContain('email');
      expect(scopes).toContain('name');
    });
  });
});
