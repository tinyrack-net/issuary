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
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('admin authentication', () => {
  test('requires an authenticated session for admin APIs', async () => {
    const adminRes = await app.request('/api/admin/me');

    expect(adminRes.status).toBe(401);
  });

  test('accepts the normal app session cookie for admin users', async () => {
    const publicLoginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    expect(publicLoginRes.status).toBe(200);
    const publicSession = extractCookie(publicLoginRes, 'session');

    const adminRes = await app.request('/api/admin/me', {
      headers: { Cookie: `session=${publicSession}` },
    });

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

    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const session = extractCookie(loginRes, 'session');

    const adminRes = await app.request('/api/admin/me', {
      headers: { Cookie: `session=${session}` },
    });

    expect(adminRes.status).toBe(403);
  });

  test('does not expose admin APIs when admin is disabled', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: false },
      users: [TEST_USER_CONFIG],
    });

    try {
      const publicLoginRes = await server.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password,
        }),
      });
      expect(publicLoginRes.status).toBe(200);
      const session = extractCookie(publicLoginRes, 'session');

      const adminRes = await server.app.request('/api/admin/me', {
        headers: { Cookie: `session=${session}` },
      });

      expect(adminRes.status).toBe(404);
    } finally {
      await server.cleanup();
    }
  });

  test('does not expose duplicated admin login endpoints', async () => {
    const loginRes = await app.request('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });

    expect(loginRes.status).toBe(404);
  });
});
