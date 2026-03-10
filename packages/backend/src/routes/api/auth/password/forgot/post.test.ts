import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createTestApp,
  createTestMailConfig,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;
const REGISTERED_USER_PASSWORD = 'password123!';

beforeAll(async () => {
  const mail = await createTestMailConfig();
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      mail,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        allowed_signup_emails: ['*'],
      },
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

describe('POST /api/auth/password/forgot', () => {
  test('should send password reset email for valid user', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('forgot');
    await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    // 2. Request password reset
    const client = testClient(app);
    const res = await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ok');

    // 3. Check that a reset token was generated
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const reset = await services.mikro.passwordReset.findOne({
        user,
        used: false,
        expiresAt: { $gt: new Date() },
      });
      return reset?.token;
    });

    expect(token).toBeDefined();
  });

  test('should return success for non-existent email (prevent enumeration)', async () => {
    const client = testClient(app);
    const res = await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'nonexistent-user@example.com',
      },
    });

    // Should still return 200 to prevent email enumeration
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ok');
  });

  test('should fail for config user (config-managed)', async () => {
    // Use the config user email from config.test.yaml
    const client = testClient(app);
    const res = await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'test-config-user@example.com',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ok');
  });

  test('should invalidate previous reset tokens when new one is generated', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('invalidate');
    await registerUser(app, {
      email: uniqueEmail,
      password: REGISTERED_USER_PASSWORD,
    });

    // 2. Request first password reset
    const client = testClient(app);
    await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
      },
    });

    // 3. Get first token
    const firstToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const reset = await services.mikro.passwordReset.findOneOrFail({
        user,
        used: false,
      });
      return reset.token;
    });

    // 4. Request second password reset
    await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
      },
    });

    // 5. Check that first token is now expired
    const isFirstTokenValid = await withMikroContext(services, async () => {
      const reset = await services.mikro.passwordReset.findOne({
        token: firstToken,
        used: false,
        expiresAt: { $gt: new Date() },
      });
      return reset !== null;
    });

    expect(isFirstTokenValid).toBe(false);

    // 6. Check that a new valid token exists
    const hasNewToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      const reset = await services.mikro.passwordReset.findOne({
        user,
        used: false,
        expiresAt: { $gt: new Date() },
      });
      return reset !== null && reset.token !== firstToken;
    });

    expect(hasNewToken).toBe(true);
  });
});

// Note: Password reset tests are in the dedicated reset/post.test.ts file

describe('POST /api/auth/password/forgot (smtp disabled)', () => {
  let appNoSmtp: AppType;
  let cleanupNoSmtp: () => Promise<void>;

  beforeAll(async () => {
    const configWithoutSmtp = MINIMAL_TEST_CONFIG;
    const server = await createTestApp({
      config: {
        ...configWithoutSmtp,
        users: [TEST_USER_CONFIG],
      },
    });
    appNoSmtp = server.app;
    cleanupNoSmtp = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoSmtp();
  });

  test('should return EMAIL_NOT_ACTIVATED when smtp is disabled', async () => {
    const client = testClient(appNoSmtp);
    const res = await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: TEST_USER_CONFIG.email,
      },
    });

    await expectError(res, e.EmailNotActivated);
  });
});

describe('POST /api/auth/password/forgot (password disabled)', () => {
  let appPasswordDisabled: AppType;
  let cleanupPasswordDisabled: () => Promise<void>;

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
    appPasswordDisabled = server.app;
    cleanupPasswordDisabled = server.cleanup;
  });

  afterAll(async () => {
    await cleanupPasswordDisabled();
  });

  test('should return validation error when password auth is disabled', async () => {
    const client = testClient(appPasswordDisabled);
    const res = await client.api.auth.password.forgot.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: TEST_USER_CONFIG.email,
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password authentication is disabled');
  });
});
