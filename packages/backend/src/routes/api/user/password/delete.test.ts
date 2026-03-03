import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
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
): Promise<{ sessionCookie: string; userSub: string }> {
  let userSub!: string;

  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: password, // Will be hashed by entity lifecycle hook
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
    userSub = user.sub;
  });

  const client = testClient(app);
  const loginRes = await client.api.auth.login.$post({
    json: { email, password },
  });

  expect(loginRes.status).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');

  return { sessionCookie, userSub };
}

describe('DELETE /api/user/password', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.password.$delete({
      json: {
        current_password: 'somePassword123!',
      },
    });

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 for config users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: {
          current_password: 'changemelater',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 403);
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

    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: {
          current_password: 'somePassword123!',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
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
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: {
          current_password: 'wrongPassword123!',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 401);
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
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('CANNOT_REMOVE_LAST_AUTH_METHOD');
  });

  test('should remove password when OAuth account is linked', async () => {
    const email = generateUniqueEmail('password-delete-with-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userSub } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link an OAuth account to the user
    await withMikroContext(services, async () => {
      await services.mikro.userOAuth.linkAccount({
        userSub,
        providerName: 'google',
        providerUserId: `google-${Date.now()}`,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
        expiresAt: null,
      });
    });

    // Now delete password
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify password login no longer works
    const verifyClient = testClient(app);
    const verifyLoginRes = await verifyClient.api.auth.login.$post({
      json: { email, password },
    });

    expect(verifyLoginRes.status).toBe(401);

    // Verify session still returns has_password: false
    const sessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    expect(sessionBody.user?.has_password).toBe(false);
  });

  test('should work with multiple OAuth accounts linked', async () => {
    const email = generateUniqueEmail('password-delete-multi-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userSub } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Link multiple OAuth accounts
    await withMikroContext(services, async () => {
      await services.mikro.userOAuth.linkAccount({
        userSub,
        providerName: 'google',
        providerUserId: `google-multi-${Date.now()}`,
        accessToken: 'fake-access-token-1',
        refreshToken: 'fake-refresh-token-1',
        expiresAt: null,
      });

      await services.mikro.userOAuth.linkAccount({
        userSub,
        providerName: 'github',
        providerUserId: `github-multi-${Date.now()}`,
        accessToken: 'fake-access-token-2',
        refreshToken: 'fake-refresh-token-2',
        expiresAt: null,
      });
    });

    // Delete password should succeed
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);
  });

  test('should return 400 when 2FA (TOTP) is set up without OAuth', async () => {
    const email = generateUniqueEmail('password-delete-totp-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userSub } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Enable TOTP for the user
    await withMikroContext(services, async () => {
      const secret = services.totpService.generateSecret();
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();
    });

    // Try to delete password without OAuth account
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY');
  });

  test('should return 400 when Passkey is set up without OAuth', async () => {
    const email = generateUniqueEmail('password-delete-passkey-no-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userSub } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Register a passkey for the user
    await withMikroContext(services, async () => {
      const passkey = services.mikro.userPasskey.create({
        user: userSub,
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
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY');
  });

  test('should allow password removal with 2FA and OAuth', async () => {
    const email = generateUniqueEmail('password-delete-totp-with-oauth');
    const password = 'validPassword123!';

    const { sessionCookie, userSub } = await createUserWithPasswordAndSession(
      email,
      password,
    );

    // Enable TOTP AND link OAuth account
    await withMikroContext(services, async () => {
      const secret = services.totpService.generateSecret();
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();

      await services.mikro.userOAuth.linkAccount({
        userSub,
        providerName: 'google',
        providerUserId: `google-${Date.now()}`,
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
        expiresAt: null,
      });
    });

    // Delete password should succeed
    const client = testClient(app);
    const res = await client.api.user.password.$delete(
      {
        json: { current_password: password },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);
  });
});

describe('DELETE /api/user/password - password disabled', () => {
  let appSession: AppType;
  let cleanupSession: () => Promise<void>;
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const sessionServer = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
      },
    });
    appSession = sessionServer.app;
    cleanupSession = sessionServer.cleanup;

    const disabledServer = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          password: {
            enabled: false,
          },
        },
      },
    });
    appDisabled = disabledServer.app;
    cleanupDisabled = disabledServer.cleanup;
  });

  afterAll(async () => {
    await cleanupSession();
    await cleanupDisabled();
  });

  test('should return validation error when password auth is disabled', async () => {
    const sessionCookie = await createAuthenticatedSession(appSession);

    const client = testClient(appDisabled);
    const res = await client.api.user.password.$delete(
      {
        json: {
          current_password: 'changemelater',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password authentication is disabled');
  });
});
