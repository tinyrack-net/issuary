import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import {
  createAuthenticatedSession,
  createTestClient,
  createTestClientWithHeaders,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
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
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/v1/user/session', () => {
  test('should return unauthenticated status when user is not logged in', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.user.session.$get();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should return authenticated status when user is logged in', async () => {
    // First, login to create a session
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Now, get session with the cookie
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const sessionRes = await authedClient.api.v1.user.session.$get();

    expect(sessionRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const sessionBody: any = await sessionRes.json();
    expect(sessionBody).toHaveProperty('user');
    expect(sessionBody.user).toHaveProperty('id');

    // Verify user id matches = logged-in user
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const loginBody: any = await loginRes.json();
    expect(sessionBody.user.id).toBe(loginBody.user.id);
    expect(sessionBody.user).toHaveProperty('second_factor_required');
  });

  test('should return unauthenticated after logout', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // Verify session exists
    const maybeHasSessionRes = await authedClient.api.v1.user.session.$get();

    expect(maybeHasSessionRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const sessionBody: any = await maybeHasSessionRes.json();
    expect(sessionBody).toHaveProperty('user');

    const logoutRes = await authedClient.api.v1.auth.logout.$post();
    expect(logoutRes.status).toBe(200);

    // Get cookie after logout - parse from Set-Cookie header since session is cleared
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is unauthenticated after logout
    const logoutClient = createTestClientWithHeaders(app, {
      Cookie: logoutSessionCookie ?? '',
    });
    const maybeNoSessionRes = await logoutClient.api.v1.user.session.$get();

    expect(maybeNoSessionRes.status).toBe(200);
    const sessionBody2 = await maybeNoSessionRes.json();
    expect(sessionBody2).not.toHaveProperty('user');
  });

  test('should return unauthenticated with invalid cookie', async () => {
    const client = createTestClientWithHeaders(app, {
      Cookie: 'invalid-cookie=invalid-value',
    });
    const res = await client.api.v1.user.session.$get();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should handle multiple session requests with same cookie', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // Make multiple session requests
    for (let i = 0; i < 3; i++) {
      const sessionRes = await client.api.v1.user.session.$get();

      expect(sessionRes.status).toBe(200);
      // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
      const sessionBody: any = await sessionRes.json();
      expect(sessionBody.user).toHaveProperty('id');
    }
  });
});
