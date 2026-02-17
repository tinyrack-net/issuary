import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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

describe('POST /api/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.password.$post({
      json: { password: 'newPassword123!' },
    });

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    // Config users cannot modify their password
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.user.password.$post(
      {
        json: { password: 'newPassword123!' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 403);
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 409 when password is already set', async () => {
    const email = generateUniqueEmail('password-post-already-set');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Try to set password again
    const client = testClient(app);
    const res = await client.api.user.password.$post(
      {
        json: { password: 'anotherPassword123!' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 409);
    expect(body.code).toBe('PASSWORD_ALREADY_SET');
  });

  test('should set password for OAuth-only user', async () => {
    const email = generateUniqueEmail('password-post-oauth-only');
    const newPassword = 'newPassword123!';

    // Create OAuth-only user and get session
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Create a temporary password for login
      user.password_hash = 'tempPassword123!';
      await services.mikro.em.flush();
    });

    const loginClient = testClient(app);
    const loginRes = await loginClient.api.auth.login.$post({
      json: {
        email,
        password: 'tempPassword123!',
      },
    });

    expect(loginRes.status).toBe(200);

    // Remove password after login to simulate OAuth-only user
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await services.mikro.em.flush();
    });

    const sessionCookie = extractCookie(loginRes, 'session');

    // Now set password for OAuth-only user
    const client = testClient(app);
    const res = await client.api.user.password.$post(
      {
        json: { password: newPassword },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify password was set by trying to login
    const verifyClient = testClient(app);
    const verifyLoginRes = await verifyClient.api.auth.login.$post({
      json: { email, password: newPassword },
    });

    expect(verifyLoginRes.status).toBe(200);
  });

  test('should validate password format', async () => {
    const email = generateUniqueEmail('password-post-validation');

    // Create OAuth-only user and get session
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      user.password_hash = 'tempPassword123!';
      await services.mikro.em.flush();
    });

    const loginClient = testClient(app);
    const loginRes = await loginClient.api.auth.login.$post({
      json: {
        email,
        password: 'tempPassword123!',
      },
    });

    // Remove password after login
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await services.mikro.em.flush();
    });

    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to set a password that's too short
    const client = testClient(app);
    const res = await client.api.user.password.$post(
      {
        json: { password: 'short' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });
});
