import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../../entrypoints/app.ts';
import { e } from '../../../../../schemas/error.ts';
import type { ServiceContainer } from '../../../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  createTestEmailConfig,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  withMikroContext,
} from '../../../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const mail = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    email: mail,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
    terms: TEST_TERMS_CONFIG,
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/auth/password/reset', () => {
  test('should return 400 for invalid token', async () => {
    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: 'invalid-token',
        password: 'NewPassword123!',
      },
    });

    const json = await assertJsonBody(res, 400);
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 400 for expired token', async () => {
    const email = generateUniqueEmail('password-reset-expired');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password,
    });
    expect(registerRes.status).toBe(200);

    // Generate token and then expire it
    const expiredToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });

      // Generate token first
      const resetEntity = await services.passwordResetService.generateToken({
        userSub: user.sub,
        expiresInHours: 1,
      });

      // Manually set expiration to past
      resetEntity.expiresAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: expiredToken,
        password: 'NewPassword123!',
      },
    });

    const json = await assertJsonBody(res, 400);
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should successfully reset password with valid token', async () => {
    const email = generateUniqueEmail('password-reset-valid');
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password: oldPassword,
    });
    expect(registerRes.status).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });

      const resetEntity = await services.passwordResetService.generateToken({
        userSub: user.sub,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: validToken,
        password: newPassword,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBeDefined();
    expect(json.message).toContain('Password has been reset');

    // Verify new password works
    const loginRes = await client.api.auth.login.$post({
      json: {
        email,
        password: newPassword,
      },
    });

    expect(loginRes.status).toBe(200);

    // Verify old password no longer works
    const oldLoginRes = await client.api.auth.login.$post({
      json: {
        email,
        password: oldPassword,
      },
    });

    expect(oldLoginRes.status).toBe(401);
  });

  test('should invalidate token after use', async () => {
    const email = generateUniqueEmail('password-reset-reuse');
    const password = 'TestPassword123!';

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password,
    });
    expect(registerRes.status).toBe(200);

    // Generate valid token
    const validToken = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });

      const resetEntity = await services.passwordResetService.generateToken({
        userSub: user.sub,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const client = testClient(app);

    // First reset should succeed
    const res1 = await client.api.auth.password.reset.$post({
      json: {
        token: validToken,
        password: 'NewPassword123!',
      },
    });

    expect(res1.status).toBe(200);

    // Second reset with same token should fail
    const res2 = await client.api.auth.password.reset.$post({
      json: {
        token: validToken,
        password: 'AnotherPassword123!',
      },
    });

    const json = await assertJsonBody(res2, 400);
    expect(json.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });

  test('should return 403 for config-managed user', async () => {
    const email = generateUniqueEmail('password-reset-config-managed');

    // Register user via HTTP
    const registerRes = await registerUser(app, {
      email,
      password: 'TestPassword123!',
    });
    expect(registerRes.status).toBe(200);

    // Make user config-managed and generate token
    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });
      user.managed_by = 'config';
      await services.mikro.em.flush();

      const resetEntity = await services.passwordResetService.generateToken({
        userSub: user.sub,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();

      return resetEntity.token;
    });

    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token,
        password: 'NewPassword123!',
      },
    });

    const json = await assertJsonBody(res, 403);
    expect(json.code).toBe('USER_NOT_EDITABLE');
  });

  test('should validate password format', async () => {
    const email = generateUniqueEmail('password-reset-policy');
    const password = 'TestPassword123!';

    const registerRes = await registerUser(app, {
      email,
      password,
    });
    expect(registerRes.status).toBe(200);

    const token = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });
      const resetEntity = await services.passwordResetService.generateToken({
        userSub: user.sub,
        expiresInHours: 1,
      });
      await services.mikro.em.flush();
      return resetEntity.token;
    });

    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token,
        password: '123',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password must be at least 12 characters long.');
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible
    const client = testClient(app);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: 'any-token',
        password: 'ValidPassword123!',
      },
    });

    // Should not return 401 (will be 400 for invalid token)
    expect(res.status).not.toBe(401);
  });
});

describe('POST /api/auth/password/reset (smtp disabled)', () => {
  let appNoSmtp: AppType;
  let cleanupNoSmtp: () => Promise<void>;

  beforeAll(async () => {
    const configWithoutSmtp = MINIMAL_TEST_CONFIG;
    const server = await createTestApp({
      ...configWithoutSmtp,
    });
    appNoSmtp = server.app;
    cleanupNoSmtp = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoSmtp();
  });

  test('should return EMAIL_NOT_ACTIVATED when smtp is disabled', async () => {
    const client = testClient(appNoSmtp);
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: 'dummy-token',
        password: 'NewPassword123!',
      },
    });

    await expectError(res, e.EmailNotActivated);
  });
});

describe('POST /api/auth/password/reset (password disabled)', () => {
  let appPasswordDisabled: AppType;
  let cleanupPasswordDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: false,
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
    const res = await client.api.auth.password.reset.$post({
      json: {
        token: 'dummy-token',
        password: 'NewPassword123!',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password authentication is disabled');
  });
});
