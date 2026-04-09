import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/auth/logout', () => {
  test('should logout successfully with valid session', async () => {
    // First, login to create a session
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
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
    const authedClient = testClient(app);
    const logoutRes = await authedClient.api.auth.logout.$post(
      {},
      { headers: { Cookie: sessionCookie ?? '' } },
    );

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully even without valid session', async () => {
    // Logout without any session
    const client = testClient(app);
    const logoutRes = await client.api.auth.logout.$post();

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should logout successfully with invalid session cookie', async () => {
    // Logout with invalid cookie
    const client = testClient(app);
    const logoutRes = await client.api.auth.logout.$post(
      {},
      { headers: { Cookie: 'invalid-cookie=invalid-value' } },
    );

    expect(logoutRes.status).toBe(200);
    const body = await logoutRes.json();
    expect(body).toHaveProperty('ok');
    expect(body.ok).toBe(true);
  });

  test('should purge session after logout', async () => {
    // Login to create a session
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    // Verify session exists
    const authedClient = testClient(app);
    const sessionRes1 = await authedClient.api.user.session.$get(
      {},
      { headers: { Cookie: sessionCookie ?? '' } },
    );

    expect(sessionRes1.status).toBe(200);
    const sessionBody1 = await assertJsonBody(sessionRes1);
    expect(sessionBody1.user).not.toBeNull();

    // Logout
    const logoutRes = await authedClient.api.auth.logout.$post(
      {},
      { headers: { Cookie: sessionCookie ?? '' } },
    );

    expect(logoutRes.status).toBe(200);

    // Get new cookie after logout
    const logoutSetCookieHeader = logoutRes.headers.get('set-cookie');
    const logoutSessionCookie = logoutSetCookieHeader?.split(';')[0];

    // Verify session is purged after logout
    const logoutClient = testClient(app);
    const sessionRes2 = await logoutClient.api.user.session.$get(
      {},
      { headers: { Cookie: logoutSessionCookie ?? '' } },
    );

    expect(sessionRes2.status).toBe(200);
    const sessionBody2 = await sessionRes2.json();
    expect(sessionBody2.user).toBeNull();
  });

  test('should handle multiple logout calls', async () => {
    // Login
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader?.split(';')[0];

    const authedClient = testClient(app);

    // First logout
    const logoutRes1 = await authedClient.api.auth.logout.$post(
      {},
      { headers: { Cookie: sessionCookie ?? '' } },
    );

    expect(logoutRes1.status).toBe(200);
    const body1 = await logoutRes1.json();
    expect(body1.ok).toBe(true);

    // Second logout with same cookie (should still succeed)
    const logoutRes2 = await authedClient.api.auth.logout.$post(
      {},
      { headers: { Cookie: sessionCookie ?? '' } },
    );

    expect(logoutRes2.status).toBe(200);
    const body2 = await logoutRes2.json();
    expect(body2.ok).toBe(true);
  });
});
