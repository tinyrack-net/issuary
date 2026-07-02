import { Hono } from 'hono';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.ts';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('admin authentication', () => {
  test('requires an authenticated session for admin APIs', async () => {
    const adminRes = await client.api.admin.me.$get();

    expect(adminRes.status).toBe(401);
  });

  test('accepts the normal app session cookie for admin users', async () => {
    const publicLoginRes = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });
    expect(publicLoginRes.status).toBe(200);
    const publicSession = extractCookie(publicLoginRes, 'session');

    const adminRes = await client.api.admin.me.$get(
      {},
      { headers: { Cookie: `session=${publicSession}` } },
    );

    expect(adminRes.status).toBe(200);
    const body = await assertJsonBody(adminRes);
    expect(body.user).toMatchObject({
      sub: TEST_USER_CONFIG.sub,
      email: TEST_USER.email,
      role: 'admin',
    });
  });

  test('rejects normal app sessions for non-admin users', async () => {
    const email = generateUniqueEmail('plain-user');
    const password = 'plain-password';
    await withMikroContext(services, () =>
      services.passwordAuthService.createDatabaseUser({
        email,
        password,
      }),
    );

    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const session = extractCookie(loginRes, 'session');

    const adminRes = await client.api.admin.me.$get(
      {},
      { headers: { Cookie: `session=${session}` } },
    );

    expect(adminRes.status).toBe(403);
  });

  test('does not expose admin APIs when admin is disabled', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: false },
      users: [TEST_USER_CONFIG],
    });

    try {
      const disabledClient = testClient(server.app);
      const publicLoginRes = await disabledClient.api.auth.login.$post({
        json: {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
      });
      expect(publicLoginRes.status).toBe(200);
      const session = extractCookie(publicLoginRes, 'session');

      const adminRes = await disabledClient.api.admin.me.$get(
        {},
        { headers: { Cookie: `session=${session}` } },
      );

      expect(adminRes.status).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('does not expose duplicated admin login endpoints', async () => {
    const fallbackClient = createAdminLoginFallbackClient(app);
    const loginRes = await fallbackClient.api.admin.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(404);
  });
});

function createAdminLoginFallbackClient(honoApp: AppType) {
  const fallbackApp = new Hono().post('/api/admin/auth/login', (c) =>
    honoApp.fetch(c.req.raw),
  );
  return testClient(fallbackApp);
}
