import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { UserEntity } from '#backend/entities/user.entity.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/user/session', () => {
  test('should return unauthenticated status when user is not logged in', async () => {
    const client = testClient(app);
    const res = await client.api.user.session.$get();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test('should return authenticated status when user is logged in', async () => {
    // First, login to create a session
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Now, get session with the cookie
    const authedClient = testClient(app);
    const sessionRes = await authedClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    const sessionUser = sessionBody.user;
    if (!sessionUser) return;
    expect(sessionUser).toHaveProperty('sub');

    // Verify user sub matches = logged-in user
    const loginBody = await assertJsonBody(loginRes);
    expect(sessionUser.sub).toBe(loginBody.user?.sub);
    expect(sessionUser).toHaveProperty('second_factor_required');
  });

  test('should return unauthenticated after logout', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const authedClient = testClient(app);

    // Verify session exists
    const maybeHasSessionRes = await authedClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const sessionBody = await assertJsonBody(maybeHasSessionRes);
    expect(sessionBody).toHaveProperty('user');

    const logoutRes = await authedClient.api.auth.logout.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(logoutRes.status).toBe(200);

    // Get cookie after logout - parse from Set-Cookie header since session is cleared
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is unauthenticated after logout
    const logoutClient = testClient(app);
    const maybeNoSessionRes = await logoutClient.api.user.session.$get(
      {},
      { headers: { Cookie: logoutSessionCookie ?? '' } },
    );

    expect(maybeNoSessionRes.status).toBe(200);
    const sessionBody2 = await maybeNoSessionRes.json();
    expect(sessionBody2.user).toBeNull();
  });

  test('should return unauthenticated with invalid cookie', async () => {
    const client = testClient(app);
    const res = await client.api.user.session.$get(
      {},
      { headers: { Cookie: 'invalid-cookie=invalid-value' } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test('should return unauthenticated and clear session when user is deleted from database', async () => {
    const email = generateUniqueEmail('deleted-session');
    const password = 'testPassword123';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Verify session works before deletion
    const client = testClient(app);
    const beforeRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const beforeBody = await assertJsonBody(beforeRes);
    expect(beforeBody.user).not.toBeNull();
    expect(beforeBody.user?.sub).toBe(userSub);

    // Hard-delete the user from the database
    await withMikroContext(services, async () => {
      await services.mikro.em.nativeDelete(UserEntity, { sub: userSub });
    });

    // Request session with stale cookie - should return user: null
    const afterRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(afterRes.status).toBe(200);
    const afterBody = await afterRes.json();
    expect(afterBody.user).toBeNull();

    // Verify the session cookie is cleared (Set-Cookie header should delete it)
    const setCookieHeader = afterRes.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
  });

  test('should handle multiple session requests with same cookie', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);

    // Make multiple session requests
    for (let i = 0; i < 3; i++) {
      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user).toHaveProperty('sub');
    }
  });
});
