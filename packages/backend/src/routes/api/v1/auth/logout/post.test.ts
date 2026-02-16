import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import {
  createTestClient,
  createTestClientWithHeaders,
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

describe('POST /api/v1/auth/logout', () => {
  test('should logout successfully with valid session', async () => {
    // First, login to create a session
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    // Extract Set-Cookie header from login response
    const setCookieHeader = loginRes.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();

    // Parse cookie value
    const sessionCookie = setCookieHeader?.split(';')[0];

    // Logout with the session cookie
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: sessionCookie ?? '',
    });
    const logoutRes = await authedClient.api.v1.auth.logout.$post();

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully even without valid session', async () => {
    // Logout without any session
    const client = createTestClient(app);
    const logoutRes = await client.api.v1.auth.logout.$post();

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully with invalid session cookie', async () => {
    // Logout with invalid cookie
    const client = createTestClientWithHeaders(app, {
      Cookie: 'invalid-cookie=invalid-value',
    });
    const logoutRes = await client.api.v1.auth.logout.$post();

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should purge session after logout', async () => {
    // Login to create a session
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    // Verify session exists
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: sessionCookie ?? '',
    });
    const sessionRes1 = await authedClient.api.v1.user.session.$get();

    expect(sessionRes1.status).toBe(200);
    const sessionBody1 = await sessionRes1.json();
    expect(sessionBody1.user).not.toBeNull();

    // Logout
    const logoutRes = await authedClient.api.v1.auth.logout.$post();

    expect(logoutRes.status).toBe(200);

    // Get new cookie after logout
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is purged after logout
    const logoutClient = createTestClientWithHeaders(app, {
      Cookie: logoutSessionCookie ?? '',
    });
    const sessionRes2 = await logoutClient.api.v1.user.session.$get();

    expect(sessionRes2.status).toBe(200);
    const sessionBody2 = await sessionRes2.json();
    expect(sessionBody2).not.toHaveProperty('user');
  });

  test('should handle multiple logout calls', async () => {
    // Login
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: sessionCookie ?? '',
    });

    // First logout
    const logoutRes1 = await authedClient.api.v1.auth.logout.$post();

    expect(logoutRes1.status).toBe(200);
    const body1 = await logoutRes1.json();
    expect(body1.ok).toBe(true);

    // Second logout with same cookie (should still succeed)
    const logoutRes2 = await authedClient.api.v1.auth.logout.$post();

    expect(logoutRes2.status).toBe(200);
    const body2 = await logoutRes2.json();
    expect(body2.ok).toBe(true);
  });
});
