import type { AppType } from '@backend/lib/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  createTestClient,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      terms: TEST_TERMS_CONFIG,
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/v1/auth/login', () => {
  test('should login successfully with correct credentials (app config user)', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const body: any = await res.json();
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('second_factor_required');
  });

  test('should login successfully with correct credentials (registered user)', async () => {
    // First, register a new user
    const uniqueEmail = generateUniqueEmail('loginuser');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    expect(registerRes.status).toBe(200);

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(loginRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const body: any = await loginRes.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should require email verification for unverified user when email_verification is enabled', async () => {
    // Register a new user (email_verified will be false by default)
    const uniqueEmail = generateUniqueEmail('unverified');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    expect(registerRes.status).toBe(200);

    // Try to login - should require email verification
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(loginRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const body: any = await loginRes.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should login successfully after email is verified', async () => {
    // Register a new user
    const uniqueEmail = generateUniqueEmail('verified');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    expect(registerRes.status).toBe(200);

    // Manually verify the email in the database
    await services.mikro.em.fork().transactional(async (em) => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      user.email_verified = true;
      await em.flush();
    });

    // Now login should succeed
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(loginRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const body: any = await loginRes.json();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.email_verified).toBe(true);
  });

  test('should allow config user to login without email verification', async () => {
    // Config users should bypass email verification requirement
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: test assertion uses dynamic property access
    const body: any = await res.json();
    expect(body.user.managed_by).toBe('config');
  });

  test('should fail with wrong password', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: 'admin@example.com',
        password: 'wrongpassword',
      },
    });

    await expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with non-existent email', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      },
    });

    await expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with invalid email format', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: 'not-an-email',
        password: 'anypassword',
        // biome-ignore lint/suspicious/noExplicitAny: test requires invalid input
      } as any,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: 'admin@example.com',
        password: '12345',
        // biome-ignore lint/suspicious/noExplicitAny: test requires invalid input
      } as any,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        password: 'changemelater',
        // biome-ignore lint/suspicious/noExplicitAny: test requires invalid input
      } as any,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.login.$post({
      json: {
        email: 'admin@example.com',
        // biome-ignore lint/suspicious/noExplicitAny: test requires invalid input
      } as any,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail to login with deleted user', async () => {
    const uniqueEmail = generateUniqueEmail('deleteduser');
    const password = 'password123';

    // First, register a new user
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password,
    });
    expect(registerRes.status).toBe(200);

    // Verify user can login before deletion (will require email verification)
    const client = createTestClient(app);
    const loginBeforeRes = await client.api.v1.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: password,
      },
    });
    expect(loginBeforeRes.status).toBe(200);
    // Unverified user will get email_verification_required

    // Soft delete the user by setting deleted_at
    await services.mikro.em.fork().transactional(async (em) => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      user.deleted_at = new Date();
      await em.flush();
    });

    // Attempt to login with deleted user
    const loginAfterRes = await client.api.v1.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: password,
      },
    });

    // Should fail with InvalidEmailOrPassword error
    await expectError(loginAfterRes, e.InvalidEmailOrPassword);
  });
});
