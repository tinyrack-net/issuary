import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createTestApp,
  createTestSmtpConfig,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const smtp = await createTestSmtpConfig();
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      smtp,
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

const REGISTERED_USER_PASSWORD = 'password123!';

describe('POST /api/auth/login', () => {
  test('should login successfully with correct credentials (app config user)', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    const body = await assertJsonBody(res);
    expect(body.user).toHaveProperty('sub');
    expect(body.user).toHaveProperty('second_factor_required');
  });

  test('should login successfully with correct credentials (registered user)', async () => {
    // First, register a new user
    const uniqueEmail = generateUniqueEmail('loginuser');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    expect(registerRes.status).toBe(200);

    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: REGISTERED_USER_PASSWORD,
      },
    });

    const body = await assertJsonBody(loginRes);
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should require email verification for unverified user when email_verification is enabled', async () => {
    // Register a new user (email_verified will be false by default)
    const uniqueEmail = generateUniqueEmail('unverified');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    expect(registerRes.status).toBe(200);

    // Try to login - should require email verification
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: REGISTERED_USER_PASSWORD,
      },
    });

    const body = await assertJsonBody(loginRes);
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should login successfully after email is verified', async () => {
    // Register a new user
    const uniqueEmail = generateUniqueEmail('verified');
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
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
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: REGISTERED_USER_PASSWORD,
      },
    });

    const body = await assertJsonBody(loginRes);
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.email_verified).toBe(true);
  });

  test('should allow config user to login without email verification', async () => {
    // Config users should bypass email verification requirement
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    const body = await assertJsonBody(res);
    expect(body.user.managed_by).toBe('config');
  });

  test('should fail with wrong password', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: 'admin@example.com',
        password: 'wrongpassword',
      },
    });

    await expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with non-existent email', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      },
    });

    await expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with invalid email format', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: 'not-an-email',
        password: 'anypassword',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with short password', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      json: {
        email: 'admin@example.com',
        password: '12345',
      },
    });

    await expectError(res, e.InvalidEmailOrPassword);
  });

  test('should fail with missing email', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      // @ts-expect-error testing validation with invalid input
      json: {
        password: 'changemelater',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with missing password', async () => {
    const client = testClient(app);
    const res = await client.api.auth.login.$post({
      // @ts-expect-error testing validation with invalid input
      json: {
        email: 'admin@example.com',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail to login with deleted user', async () => {
    const uniqueEmail = generateUniqueEmail('deleteduser');
    const password = REGISTERED_USER_PASSWORD;

    // First, register a new user
    const registerRes = await registerUser(app, {
      email: uniqueEmail,
      password,
    });
    expect(registerRes.status).toBe(200);

    // Verify user can login before deletion (will require email verification)
    const client = testClient(app);
    const loginBeforeRes = await client.api.auth.login.$post({
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
    const loginAfterRes = await client.api.auth.login.$post({
      json: {
        email: uniqueEmail,
        password: password,
      },
    });

    // Should fail with InvalidEmailOrPassword error
    await expectError(loginAfterRes, e.InvalidEmailOrPassword);
  });
});

describe('POST /api/auth/login - password disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          password: {
            ...MINIMAL_TEST_CONFIG.auth.password,
            enabled: false,
          },
        },
      },
    });
    appDisabled = server.app;
    cleanupDisabled = server.cleanup;
  });

  afterAll(async () => {
    await cleanupDisabled();
  });

  test('should return validation error when password auth is disabled', async () => {
    const client = testClient(appDisabled);
    const res = await client.api.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password authentication is disabled');
  });
});
