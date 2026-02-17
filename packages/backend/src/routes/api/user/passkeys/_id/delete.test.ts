import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createPasskeyForUser,
  enableTotpForUser,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('DELETE /api/user/passkeys/:id', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          passkey: {
            enabled: true,
            email_verification: true,
          },
        },
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
   * Helper to create a DB user with session (with or without password)
   */
  async function createDbUserWithSession(
    email: string,
    password: string,
    options?: { hasPassword?: boolean },
  ): Promise<{
    sessionCookie: string;
    userId: string;
  }> {
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: options?.hasPassword === false ? null : password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });

    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');
    const body = await assertJsonBody(loginRes);
    const userId = body.user.id;

    return { sessionCookie, userId };
  }

  /**
   * Helper to link an OAuth account to a user
   */
  async function linkOAuthAccount(userId: string): Promise<void> {
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        id: userId,
      });
      const oauthAccount = services.mikro.userOAuth.create({
        user,
        provider_name: 'google',
        provider_user_id: `google-${crypto.randomUUID()}`,
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: null,
      });
      await services.mikro.em.persist(oauthAccount).flush();
    });
  }

  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete({
      param: {
        id: '00000000-0000-0000-0000-000000000000',
      },
    });

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 404 when passkey does not exist', async () => {
    const email = generateUniqueEmail('passkey-delete-not-found');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: {
          id: '00000000-0000-0000-0000-000000000000',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 404);
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should successfully delete passkey when user has password', async () => {
    const email = generateUniqueEmail('passkey-delete-with-password');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Test Passkey',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify passkey was deleted
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).toBeNull();
    });
  });

  test('should successfully delete one of multiple passkeys', async () => {
    const email = generateUniqueEmail('passkey-delete-one-of-many');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId1 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 1',
    );
    const passkeyId2 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 2',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId1 },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify first passkey was deleted
    await withMikroContext(services, async () => {
      const passkey1 = await services.mikro.userPasskey.findOne({
        id: passkeyId1,
      });
      expect(passkey1).toBeNull();

      // Second passkey should still exist
      const passkey2 = await services.mikro.userPasskey.findOne({
        id: passkeyId2,
      });
      expect(passkey2).not.toBeNull();
    });
  });

  test('should not allow deleting another user passkey', async () => {
    const email1 = generateUniqueEmail('passkey-delete-user1');
    const email2 = generateUniqueEmail('passkey-delete-user2');
    const password = 'testPassword123!';

    const { sessionCookie: session1 } = await createDbUserWithSession(
      email1,
      password,
    );
    const { userId: userId2 } = await createDbUserWithSession(email2, password);

    // Create passkey for user2
    const passkeyId = await createPasskeyForUser(
      services,
      userId2,
      'User2 Passkey',
    );

    // User1 tries to delete user2's passkey
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${session1}` } },
    );

    const body = await assertJsonBody(res, 404);
    expect(body.code).toBe('PASSKEY_NOT_FOUND');

    // Verify the passkey was NOT deleted
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).not.toBeNull();
    });
  });

  test('should return 400 when id is not a valid UUID', async () => {
    const email = generateUniqueEmail('passkey-delete-invalid-uuid');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: 'not-a-uuid' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should allow deleting last passkey when user has linked OAuth', async () => {
    const email = generateUniqueEmail('passkey-delete-has-oauth');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Link OAuth account
    await linkOAuthAccount(userId);

    // Create only one passkey
    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Only Passkey',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify passkey was deleted
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).toBeNull();
    });
  });

  test('should allow deleting last passkey when multiple passkeys exist', async () => {
    const email = generateUniqueEmail('passkey-delete-multiple');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create multiple passkeys
    await createPasskeyForUser(services, userId, 'Passkey 1');
    const passkeyId2 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 2',
    );

    // Delete second passkey (not the last one)
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId2 },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(200);
  });

  test('should return 403 for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Get user ID from session
    const sessionClient = testClient(app);
    const sessionRes = await sessionClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    const user = sessionBody.user;
    if (!user) return;
    const userId = user.id;

    // Create passkey for config user directly in DB
    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Config User Passkey',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Config users cannot manage 2FA
    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should delete all passkeys sequentially when user has password', async () => {
    const email = generateUniqueEmail('passkey-delete-all-with-password');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId1 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 1',
    );
    const passkeyId2 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 2',
    );
    const passkeyId3 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 3',
    );

    const client = testClient(app);

    // Delete all passkeys one by one
    for (const passkeyId of [passkeyId1, passkeyId2, passkeyId3]) {
      const res = await client.api.user.passkeys[':id'].$delete(
        {
          param: { id: passkeyId },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(res.status).toBe(200);
    }

    // Verify all passkeys are deleted
    await withMikroContext(services, async () => {
      const passkeys = await services.mikro.userPasskey.findByUserId(userId);
      expect(passkeys).toHaveLength(0);
    });
  });

  test('should handle concurrent delete requests gracefully', async () => {
    const email = generateUniqueEmail('passkey-delete-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Test Passkey',
    );

    const client = testClient(app);

    // Send two concurrent delete requests
    const [res1, res2] = await Promise.all([
      client.api.user.passkeys[':id'].$delete(
        {
          param: { id: passkeyId },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      ),
      client.api.user.passkeys[':id'].$delete(
        {
          param: { id: passkeyId },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      ),
    ]);

    // One should succeed, one should fail with 404
    const statusCodes = [res1.status, res2.status].sort();
    expect(statusCodes).toContain(200);
    // Second request might get 404 or 200 depending on race condition
  });

  test('should verify passkey list is updated after deletion', async () => {
    const email = generateUniqueEmail('passkey-delete-verify-list');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId1 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 1',
    );
    await createPasskeyForUser(services, userId, 'Passkey 2');

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get initial list
    const listBefore = await client.api.user.passkeys.$get({}, { headers });
    const listBeforeBody = await assertJsonBody(listBefore);
    expect(listBeforeBody.passkeys).toHaveLength(2);

    // Delete one passkey
    await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId1 },
      },
      { headers },
    );

    // Get updated list
    const listAfter = await client.api.user.passkeys.$get({}, { headers });
    const listAfterBody = await assertJsonBody(listAfter);
    expect(listAfterBody.passkeys).toHaveLength(1);
    expect(listAfterBody.passkeys[0]?.name).toBe('Passkey 2');
  });
});

describe('DELETE /api/user/passkeys/:id - Last auth method protection', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          passkey: {
            enabled: true,
            email_verification: true,
          },
        },
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
   * Helper to create a DB user with session
   */
  async function createDbUserWithSession(
    email: string,
    password: string,
  ): Promise<{
    sessionCookie: string;
    userId: string;
  }> {
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });

    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');
    const body = await assertJsonBody(loginRes);
    const userId = body.user.id;

    return { sessionCookie, userId };
  }

  test('should prevent deleting last passkey when no other auth methods exist', async () => {
    const email = generateUniqueEmail('passkey-delete-last-only');
    const password = 'testPassword123!';

    // Create user with password
    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Remove password from user
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { id: userId },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await services.mikro.em.flush();
    });

    // Create only one passkey
    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Only Auth Method Passkey',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('CANNOT_REMOVE_LAST_PASSKEY');

    // Verify passkey was NOT deleted
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).not.toBeNull();
    });
  });

  test('should allow deleting passkey when user has multiple passkeys (no password)', async () => {
    const email = generateUniqueEmail('passkey-delete-multi-no-password');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Remove password
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { id: userId },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await services.mikro.em.flush();
    });

    // Create multiple passkeys
    const passkeyId1 = await createPasskeyForUser(
      services,
      userId,
      'Passkey 1',
    );
    await createPasskeyForUser(services, userId, 'Passkey 2');

    // Should be able to delete one (still has another)
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId1 },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);
  });
});

describe('DELETE /api/user/passkeys/:id - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          passkey: {
            enabled: false,
            email_verification: true,
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

  test('should return 400 when passkey is disabled in config', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const client = testClient(appDisabled);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: {
          id: '00000000-0000-0000-0000-000000000000',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Route is registered but handler rejects when passkey is disabled
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/user/passkeys/:id - second_factor.required: true', () => {
  let appWith2FARequired: AppType;
  let servicesWith2FA: ServiceContainer;
  let cleanupWith2FA: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          password: {
            second_factor: {
              required: true,
            },
            totp: {
              enabled: true,
            },
          },
          passkey: {
            enabled: true,
          },
        },
      },
    });
    appWith2FARequired = server.app;
    servicesWith2FA = server.services;
    cleanupWith2FA = server.cleanup;
  });

  afterAll(async () => {
    await cleanupWith2FA();
  });

  /**
   * Helper to create a passkey for a user
   */
  async function createPasskeyFor2FATest(
    userId: string,
    name: string | null = null,
  ): Promise<string> {
    let passkeyId = '';

    await withMikroContext(servicesWith2FA, async () => {
      const passkey = servicesWith2FA.mikro.userPasskey.create({
        user: userId,
        credential_id: `test-credential-${crypto.randomUUID()}`,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name,
        aaguid: 'test-aaguid',
      });
      await servicesWith2FA.mikro.em.persist(passkey).flush();
      passkeyId = passkey.id;
    });

    return passkeyId;
  }

  /**
   * Create a user with passkey already setup, then login and verify passkey
   * to get a full session (not pending2FASetup)
   * Since we can't actually do WebAuthn in tests, we create passkey directly
   * and use TOTP for authentication
   */
  async function createUserWithPasskeySession(
    emailPrefix: string,
    password: string,
  ): Promise<{
    sessionCookie: string;
    userId: string;
  }> {
    const email = generateUniqueEmail(emailPrefix);

    // Create user directly in DB
    let userId = '';
    await withMikroContext(servicesWith2FA, async () => {
      const user = servicesWith2FA.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await servicesWith2FA.mikro.em.persist(user).flush();
      userId = user.id;
    });

    // Enable TOTP for user (to be able to login)
    const totpSecret = await enableTotpForUser(servicesWith2FA, userId);

    // Login - will require 2FA verification
    const loginClient = testClient(appWith2FARequired);
    const loginRes = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);

    const loginSetCookie = loginRes.headers.get('set-cookie');
    const pending2FACookie =
      loginSetCookie?.match(/session=([^;]+)/)?.[1] ?? '';

    // Verify TOTP to get full session
    const validCode = servicesWith2FA.totpService.generateToken(totpSecret);
    const pendingClient = testClient(appWith2FARequired);
    const verifyRes = await pendingClient.api.auth.totp.verify.$post(
      {
        json: { code: validCode },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(verifyRes.status).toBe(200);

    const verifySetCookie = verifyRes.headers.get('set-cookie');
    const sessionCookie = verifySetCookie?.match(/session=([^;]+)/)?.[1] ?? '';

    return { sessionCookie, userId };
  }

  test('should prevent deleting last passkey when no TOTP exists and 2FA is required', async () => {
    const password = 'testPassword123!';

    // First create user with TOTP to get session
    const { sessionCookie, userId } = await createUserWithPasskeySession(
      'passkey-delete-2fa-required-no-totp',
      password,
    );

    // Remove TOTP from user (to test passkey-only scenario)
    await withMikroContext(servicesWith2FA, async () => {
      await servicesWith2FA.mikro.userTotp.deleteByUserId(userId);
    });

    // Create only one passkey
    const passkeyId = await createPasskeyFor2FATest(userId, 'Only Passkey');

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.CannotRemoveLastSecondFactor);

    // Verify passkey was NOT deleted
    await withMikroContext(servicesWith2FA, async () => {
      const passkey = await servicesWith2FA.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).not.toBeNull();
    });
  });

  test('should allow deleting passkey when TOTP exists and 2FA is required', async () => {
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createUserWithPasskeySession(
      'passkey-delete-2fa-required-has-totp',
      password,
    );

    // Create passkey (user already has TOTP from session setup)
    const passkeyId = await createPasskeyFor2FATest(userId, 'Test Passkey');

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);

    // Verify passkey was deleted
    await withMikroContext(servicesWith2FA, async () => {
      const passkey = await servicesWith2FA.mikro.userPasskey.findOne({
        id: passkeyId,
      });
      expect(passkey).toBeNull();
    });
  });

  test('should allow deleting one of multiple passkeys when 2FA is required', async () => {
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createUserWithPasskeySession(
      'passkey-delete-2fa-required-multiple',
      password,
    );

    // Remove TOTP to test passkey-only scenario
    await withMikroContext(servicesWith2FA, async () => {
      await servicesWith2FA.mikro.userTotp.deleteByUserId(userId);
    });

    // Create multiple passkeys (no TOTP)
    const passkeyId1 = await createPasskeyFor2FATest(userId, 'Passkey 1');
    await createPasskeyFor2FATest(userId, 'Passkey 2');

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId1 },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Should succeed because user still has another passkey
    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);
  });

  test('should prevent config user from deleting passkey', async () => {
    const sessionCookie = await createAuthenticatedSession(appWith2FARequired);

    // Get user ID from session
    const sessionClient = testClient(appWith2FARequired);
    const sessionRes = await sessionClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    const user = sessionBody.user;
    if (!user) return;
    const userId = user.id;

    // Create passkey directly in database for config user
    let passkeyId = '';
    await withMikroContext(servicesWith2FA, async () => {
      const passkey = servicesWith2FA.mikro.userPasskey.create({
        user: userId,
        credential_id: `test-credential-${crypto.randomUUID()}`,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Config User Passkey',
        aaguid: 'test-aaguid',
      });
      await servicesWith2FA.mikro.em.persist(passkey).flush();
      passkeyId = passkey.id;
    });

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.passkeys[':id'].$delete(
      {
        param: { id: passkeyId },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });
});
