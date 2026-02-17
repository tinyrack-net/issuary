import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
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

/**
 * Helper to create a user with password and return authenticated session
 */
async function createUserWithPasswordAndSession(
  email: string,
  password: string,
): Promise<string> {
  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
  });

  const client = testClient(app);
  const loginRes = await client.api.v1.auth.login.$post({
    json: { email, password },
  });

  expect(loginRes.status).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');

  return sessionCookie;
}

describe('PUT /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.v1.user.password.$put({
      json: {
        current_password: 'oldPassword123!',
        new_password: 'newPassword123!',
      },
    });

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.v1.user.password.$put(
      {
        json: {
          current_password: 'changemelater',
          new_password: 'newPassword123!',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 403);
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 400 when password is not set', async () => {
    const email = generateUniqueEmail('password-put-no-password');

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
    const loginRes = await loginClient.api.v1.auth.login.$post({
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

    const client = testClient(app);
    const res = await client.api.v1.user.password.$put(
      {
        json: {
          current_password: 'somePassword123!',
          new_password: 'newPassword123!',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('PASSWORD_NOT_SET');
  });

  test('should return 401 when current password is incorrect', async () => {
    const email = generateUniqueEmail('password-put-wrong-current');
    const password = 'correctPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.v1.user.password.$put(
      {
        json: {
          current_password: 'wrongPassword123!',
          new_password: 'newPassword123!',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('should change password successfully', async () => {
    const email = generateUniqueEmail('password-put-success');
    const currentPassword = 'currentPassword123!';
    const newPassword = 'newPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      currentPassword,
    );

    // Change password
    const client = testClient(app);
    const res = await client.api.v1.user.password.$put(
      {
        json: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify new password works
    const verifyClient = testClient(app);
    const verifyLoginRes = await verifyClient.api.v1.auth.login.$post({
      json: { email, password: newPassword },
    });

    expect(verifyLoginRes.status).toBe(200);

    // Verify old password no longer works
    const oldPasswordLoginRes = await verifyClient.api.v1.auth.login.$post({
      json: { email, password: currentPassword },
    });

    expect(oldPasswordLoginRes.status).toBe(401);
  });

  test('should validate new password format', async () => {
    const email = generateUniqueEmail('password-put-validation');
    const password = 'validPassword123!';

    const sessionCookie = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to change to a password that's too short
    const client = testClient(app);
    const res = await client.api.v1.user.password.$put(
      {
        json: {
          current_password: password,
          new_password: 'short',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });
});
