import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        allowed_signup_emails: ['*'],
      },
      users: [TEST_USER_CONFIG],
      terms: TEST_TERMS_CONFIG,
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/auth/password/forgot', () => {
  test('should send password reset email for valid user', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('forgot');
    await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    // 2. Request password reset
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: uniqueEmail,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('ok');

    // 3. Check that a reset token was generated
    const token = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOne({
        user,
        used: false,
        expiresAt: { $gt: new Date() },
      });
      return reset?.token;
    });

    expect(token).toBeDefined();
  });

  test('should return success for non-existent email (prevent enumeration)', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: 'nonexistent-user@example.com',
      },
    });

    // Should still return 200 to prevent email enumeration
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('ok');
  });

  test('should fail for config user (config-managed)', async () => {
    // Use the config user email from config.test.yaml
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: 'test-config-user@example.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('ok');
  });

  test('should invalidate previous reset tokens when new one is generated', async () => {
    // 1. Register a new user
    const uniqueEmail = generateUniqueEmail('invalidate');
    await registerUser(app, {
      email: uniqueEmail,
      password: 'password123',
    });

    // 2. Request first password reset
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: uniqueEmail,
      },
    });

    // 3. Get first token
    const firstToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOneOrFail({
        user,
        used: false,
      });
      return reset.token;
    });

    // 4. Request second password reset
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/password/forgot',
      payload: {
        email: uniqueEmail,
      },
    });

    // 5. Check that first token is now expired
    const isFirstTokenValid = await withMikroContext(app, async () => {
      const reset = await app.mikro.passwordReset.findOne({
        token: firstToken,
        used: false,
        expiresAt: { $gt: new Date() },
      });
      return reset !== null;
    });

    expect(isFirstTokenValid).toBe(false);

    // 6. Check that a new valid token exists
    const hasNewToken = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email: uniqueEmail });
      const reset = await app.mikro.passwordReset.findOne({
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
