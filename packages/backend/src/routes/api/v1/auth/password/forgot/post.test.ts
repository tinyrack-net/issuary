import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  registerUser,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
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
    const res = await app.request('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
      }),
      headers: { 'Content-Type': 'application/json' },
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
    const res = await app.request('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent-user@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Should still return 200 to prevent email enumeration
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('ok');
  });

  test('should fail for config user (config-managed)', async () => {
    // Use the config user email from config.test.yaml
    const res = await app.request('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test-config-user@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
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
      password: 'password123',
    });

    // 2. Request first password reset
    await app.request('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
      }),
      headers: { 'Content-Type': 'application/json' },
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
    await app.request('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
      }),
      headers: { 'Content-Type': 'application/json' },
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
