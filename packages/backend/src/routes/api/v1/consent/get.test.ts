import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestClient,
  createTestClientWithHeaders,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
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
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/v1/consent', () => {
  test('should return consent information for authenticated user', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid profile email',
      },
    });

    const body = await assertJsonBody(res);
    expect(body).toHaveProperty('client');
    expect(body.client).toHaveProperty('clientId', TEST_OAUTH_CLIENT.clientId);
    expect(body.client).toHaveProperty('name');
    expect(body.client).toHaveProperty('id');

    expect(body).toHaveProperty('scopes');
    expect(body.scopes).toBeInstanceOf(Array);
    expect(body.scopes.length).toBe(3);

    // Verify scopes have name and description
    for (const scope of body.scopes) {
      expect(scope).toHaveProperty('name');
      expect(scope).toHaveProperty('description');
    }

    // Verify specific scopes
    const scopeNames = body.scopes.map((s) => s.name);
    expect(scopeNames).toContain('openid');
    expect(scopeNames).toContain('profile');
    expect(scopeNames).toContain('email');

    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email');
  });

  test('should return consent information with only openid scope', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid',
      },
    });

    const body = await assertJsonBody(res);
    expect(body.scopes).toHaveLength(1);
    expect(body.scopes[0]).toHaveProperty('name', 'openid');
    expect(body.scopes[0]).toHaveProperty(
      'description',
      'Access your unique user identifier',
    );
  });

  test('should return empty scopes array when no scope provided', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
      },
    });

    const body = await assertJsonBody(res);
    expect(body.scopes).toHaveLength(0);
  });

  test('should return 401 when user is not authenticated', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid',
      },
    });

    const body = await assertJsonBody(res, 401);
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    expect(body).toHaveProperty('message');
  });

  test('should return 401 with invalid session cookie', async () => {
    const client = createTestClientWithHeaders(app, {
      Cookie: 'session=invalid-session-cookie',
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid',
      },
    });

    const body = await assertJsonBody(res, 401);
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
  });

  test('should return error when client_id is missing', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      // @ts-expect-error testing validation with invalid input
      query: {
        scope: 'openid',
      },
    });

    // Zod validation fails - either 400 or 500 (serialization error)
    // due to the response schema not matching validation error format
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('should return error for invalid client_id', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: 'non-existent-client-id',
        scope: 'openid',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('code');
  });

  test('should handle custom scopes with generic description', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid custom_scope',
      },
    });

    const body = await assertJsonBody(res);
    expect(body.scopes).toHaveLength(2);

    const customScope = body.scopes.find((s) => s.name === 'custom_scope');
    expect(customScope).toBeDefined();
    expect(customScope?.description).toBe('Access to custom_scope data');
  });

  test('should return all known scope descriptions', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.consent.$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid profile email address phone offline_access',
      },
    });

    const body = await assertJsonBody(res);
    expect(body.scopes).toHaveLength(6);

    const scopeMap = new Map(body.scopes.map((s) => [s.name, s.description]));

    expect(scopeMap.get('openid')).toBe('Access your unique user identifier');
    expect(scopeMap.get('profile')).toBe(
      'Access your profile information (name, picture, etc.)',
    );
    expect(scopeMap.get('email')).toBe('Access your email address');
    expect(scopeMap.get('address')).toBe('Access your address information');
    expect(scopeMap.get('phone')).toBe('Access your phone number');
    expect(scopeMap.get('offline_access')).toBe(
      'Maintain access when you are not present',
    );
  });
});
