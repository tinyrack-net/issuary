import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  createAuthenticatedSession,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/v1/consent', () => {
  describe('Allow decision', () => {
    test('should grant consent and return redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'test-state-123',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('redirect_url');

      // Verify redirect URL contains correct parameters
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.pathname).toBe('/application/oauth/authorize');
      expect(redirectUrl.searchParams.get('client_id')).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
        TEST_OAUTH_CLIENT.redirectUri,
      );
      expect(redirectUrl.searchParams.get('response_type')).toBe('code');
      expect(redirectUrl.searchParams.get('scope')).toBe(
        'openid profile email',
      );
      expect(redirectUrl.searchParams.get('state')).toBe('test-state-123');
    });

    test('should include PKCE parameters in redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.get('code_challenge')).toBe(
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      );
      expect(redirectUrl.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
    });

    test('should include nonce parameter in redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          nonce: 'test-nonce-456',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.get('nonce')).toBe('test-nonce-456');
    });

    test('should store consent in database', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Get user ID from session
      const sessionRes = await app.request('/api/v1/user/session', {
        method: 'GET',
        headers: { Cookie: `session=${sessionCookie}` },
      });
      const { user } = await sessionRes.json();

      // Grant consent
      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(200);

      // Verify consent was stored
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          id: user.id,
        });
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consent = await services.mikro.userConsent.findOne({
          user: userEntity,
          client: clientEntity,
        });

        expect(consent).not.toBeNull();
        expect(consent?.scopes).toContain('openid');
        expect(consent?.scopes).toContain('profile');
      });
    });

    test('should handle empty scope', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('redirect_url');

      const redirectUrl = new URL(body.redirect_url);
      // scope should not be in the URL if not provided
      expect(redirectUrl.searchParams.has('scope')).toBe(false);
    });
  });

  describe('Deny decision', () => {
    test('should return error redirect URL when consent is denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile',
          state: 'test-state-789',
          decision: 'deny',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('redirect_url');

      // Verify error redirect URL
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.origin).toBe('http://localhost:8080');
      expect(redirectUrl.pathname).toBe('/callback');
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('error_description')).toBe(
        'The resource owner or authorization server denied the request.',
      );
      expect(redirectUrl.searchParams.get('state')).toBe('test-state-789');
    });

    test('should not include state when not provided in deny response', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'deny',
        }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.has('state')).toBe(false);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
    });

    test('should not store consent when denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Get user ID from session
      const sessionRes = await app.request('/api/v1/user/session', {
        method: 'GET',
        headers: { Cookie: `session=${sessionCookie}` },
      });
      const { user } = await sessionRes.json();

      // Use a unique scope to verify no consent is stored
      const uniqueScope = `deny_test_${Date.now()}`;

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: uniqueScope,
          decision: 'deny',
        }),
      });

      expect(res.status).toBe(200);

      // Verify no consent with this scope was stored
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          id: user.id,
        });
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consents = await services.mikro.userConsent.findAll({
          where: {
            user: userEntity,
            client: clientEntity,
          },
        });

        // Check that no consent has the unique scope
        for (const consent of consents) {
          expect(consent.scopes).not.toContain(uniqueScope);
        }
      });
    });
  });

  describe('Authentication', () => {
    test('should return 401 when user is not authenticated', async () => {
      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(body).toHaveProperty('message');
    });

    test('should return 401 with invalid session cookie', async () => {
      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=invalid-session-cookie',
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    test('should return 400 when client_id is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 when redirect_uri is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 when response_type is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'invalid',
        }),
      });

      expect(res.status).toBe(400);
    });

    test('should return 400 when code_challenge_method is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.request('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          code_challenge: 'some-challenge',
          code_challenge_method: 'invalid',
          decision: 'allow',
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
