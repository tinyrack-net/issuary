import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    },
  });
  app = server.app;
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
    expect(sessionUser).toHaveProperty('id');

    // Verify user id matches = logged-in user
    const loginBody = await assertJsonBody(loginRes);
    expect(sessionUser.id).toBe(loginBody.user?.id);
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
      expect(sessionBody.user).toHaveProperty('id');
    }
  });
});
