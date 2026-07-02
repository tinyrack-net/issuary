import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
} from '../../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/oauth/authorization-context', () => {
  test('returns validated client, redirect, and scope context', async () => {
    const client = testClient(app);
    const res = await client.api.oauth['authorization-context'].$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
      },
    });

    const body = await assertJsonBody(res, 200);
    expect(body.client.clientId).toBe(TEST_OAUTH_CLIENT.clientId);
    expect(body.client.name).toBe('My App');
    expect(body.redirect_uri).toBe(TEST_OAUTH_CLIENT.redirectUri);
    expect(body.redirect_origin).toBe('http://localhost:8080');
    expect(body.scopes.map((scope) => scope.name)).toEqual([
      'openid',
      'profile',
      'email',
    ]);
  });

  test('rejects an unregistered redirect URI', async () => {
    const client = testClient(app);
    const res = await client.api.oauth['authorization-context'].$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: 'https://evil.example/callback',
        response_type: 'code',
        scope: 'openid',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('INVALID_REDIRECT_URI');
  });

  test('rejects unsupported scopes', async () => {
    const client = testClient(app);
    const res = await client.api.oauth['authorization-context'].$get({
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: 'openid admin',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('INVALID_SCOPE');
  });
});
