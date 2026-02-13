import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '@/lib/app.js';
import { createServer } from '@/server.js';
import type { ServiceContainer } from '@/services/container.js';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

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
 * Helper to create a user with password and return authenticated session and user ID
 */
async function createUserWithPasswordAndSession(
  email: string,
  password: string,
): Promise<{ sessionCookie: string; userId: string }> {
  let userId!: string;

  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
    userId = user.id;
  });

  const loginRes = await app.request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  });

  expect(loginRes.status).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');

  return { sessionCookie, userId };
}

describe('DELETE /api/v1/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/v1/user/password', {
      method: 'DELETE',
      body: JSON.stringify({
        current_password: 'somePassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: 'changemelater',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('USER_NOT_EDITABLE');
  });

  test('should return 400 when password is not set', async () => {
    const email = generateUniqueEmail('password-delete-no-password');

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

    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'tempPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
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

    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: 'somePassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('PASSWORD_NOT_SET');
  });

  test('should return 401 when current password is incorrect', async () => {
    const email = generateUniqueEmail('password-delete-wrong-current');
    const password = 'correctPassword123!';

    const { sessionCookie } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to delete with wrong password
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: 'wrongPassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('should return 400 when no OAuth accounts linked', async () => {
    const email = generateUniqueEmail('password-delete-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Try to delete password without any OAuth accounts
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('CANNOT_REMOVE_LAST_AUTH_METHOD');
  });

  test('should remove password when OAuth account is linked', async () => {
    const email = generateUniqueEmail('password-delete-with-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link an OAuth account to the user
    await withMikroContext(services, async () => {
      await services.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'google',
        providerUserId: `google-${Date.now()}`,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
        expiresAt: null,
      });
    });

    // Now delete password
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify password login no longer works
    const verifyLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(verifyLoginRes.status).toBe(401);

    // Verify session still returns has_password: false
    const sessionRes = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.user.has_password).toBe(false);
  });

  test('should work with multiple OAuth accounts linked', async () => {
    const email = generateUniqueEmail('password-delete-multi-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link multiple OAuth accounts
    await withMikroContext(services, async () => {
      await services.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'google',
        providerUserId: `google-multi-${Date.now()}`,
        accessToken: 'fake-access-token-1',
        refreshToken: 'fake-refresh-token-1',
        expiresAt: null,
      });

      await services.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'github',
        providerUserId: `github-multi-${Date.now()}`,
        accessToken: 'fake-access-token-2',
        refreshToken: 'fake-refresh-token-2',
        expiresAt: null,
      });
    });

    // Delete password should succeed
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('should return 400 when 2FA (TOTP) is set up without OAuth', async () => {
    const email = generateUniqueEmail('password-delete-totp-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Enable TOTP for the user
    await withMikroContext(services, async () => {
      const secret = services.totpService.generateSecret();
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();
    });

    // Try to delete password without OAuth account
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY');
  });

  test('should return 400 when Passkey is set up without OAuth', async () => {
    const email = generateUniqueEmail('password-delete-passkey-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Register a passkey for the user
    await withMikroContext(services, async () => {
      const passkey = services.mikro.userPasskey.create({
        user: userId,
        credential_id: btoa('test-credential-id'),
        public_key: 'mock-public-key',
        counter: 0,
        device_type: 'singleDevice',
        backed_up: false,
        transports: ['usb'],
      });
      await services.mikro.em.persist(passkey).flush();
    });

    // Try to delete password without OAuth account
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY');
  });

  test('should allow password removal with 2FA and OAuth', async () => {
    const email = generateUniqueEmail('password-delete-totp-with-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userId } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Enable TOTP AND link OAuth account
    await withMikroContext(services, async () => {
      const secret = services.totpService.generateSecret();
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();

      await services.mikro.userOAuth.linkAccount({
        userId,
        providerName: 'google',
        providerUserId: `google-${Date.now()}`,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
        expiresAt: null,
      });
    });

    // Delete password should succeed
    const res = await requestWithSession(
      app,
      '/api/v1/user/password',
      {
        method: 'DELETE',
        body: JSON.stringify({
          current_password: password,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
