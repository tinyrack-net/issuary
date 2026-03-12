import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/consent', () => {
  describe('Allow decision', () => {
    test('should grant consent and return redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            state: 'test-state-123',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('redirect_url');

      // Verify redirect URL contains correct parameters
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.pathname).toBe('/oauth/authorize');
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
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            code_challenge_method: 'S256',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
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
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            nonce: 'test-nonce-456',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.get('nonce')).toBe('test-nonce-456');
    });

    test('should store consent in database', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      // Get user ID from session
      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user).toBeDefined();
      const user = sessionBody.user;
      if (!user) return;

      // Grant consent
      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      // Verify consent was stored
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          sub: user.sub,
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
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('redirect_url');

      const redirectUrl = new URL(body.redirect_url);
      // scope should not be in the URL if not provided
      expect(redirectUrl.searchParams.has('scope')).toBe(false);
    });
  });

  describe('Deny decision', () => {
    test('should return error redirect URL when consent is denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile',
            state: 'test-state-789',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
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
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.has('state')).toBe(false);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
    });

    test('should not store consent when denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      // Get user ID from session
      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user).toBeDefined();
      const user = sessionBody.user;
      if (!user) return;

      // Use a unique scope to verify no consent is stored
      const uniqueScope = `deny_test_${Date.now()}`;

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: uniqueScope,
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      // Verify no consent with this scope was stored
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          sub: user.sub,
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
      const client = testClient(app);

      const res = await client.api.consent.$post({
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(body).toHaveProperty('message');
    });

    test('should return 401 with invalid session cookie', async () => {
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: 'session=invalid-session-cookie' } },
      );

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    test('should return 400 when client_id is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when redirect_uri is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when response_type is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            // @ts-expect-error testing validation with invalid input
            decision: 'invalid',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when code_challenge_method is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            code_challenge: 'some-challenge',
            // @ts-expect-error testing validation with invalid input
            code_challenge_method: 'invalid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });
  });
});
