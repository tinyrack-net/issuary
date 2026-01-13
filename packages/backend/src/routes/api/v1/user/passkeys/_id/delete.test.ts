import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer({
  configOverrides: {
    authentication_methods: {
      password: {
        type: 'password',
        enabled: true,
        email_verification: true,
        passkey: {
          enabled: true,
          required: false,
        },
      },
    },
  },
});

/**
 * Helper to create a DB user with session (with or without password)
 */
async function createDbUserWithSession(
  email: string,
  password: string,
  options?: { hasPassword?: boolean },
): Promise<{ sessionCookie: string; userId: string }> {
  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: options?.hasPassword === false ? null : password,
    });
    user.email_verified = true;
    await app.mikro.em.persist(user).flush();
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  expect(loginRes.statusCode).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');
  const userId = loginRes.json().user.id;

  return { sessionCookie, userId };
}

/**
 * Helper to create a passkey for a user
 */
async function createPasskeyForUser(
  userId: string,
  name: string | null = null,
): Promise<string> {
  let passkeyId = '';

  await withMikroContext(app, async () => {
    const user = await app.mikro.user.findOneOrFail({ id: userId });
    const passkey = app.mikro.userPasskey.create({
      user,
      credential_id: `test-credential-${crypto.randomUUID()}`,
      public_key: 'test-public-key-base64url',
      counter: 0,
      device_type: 'multiDevice',
      backed_up: true,
      transports: ['internal'],
      name,
      aaguid: 'test-aaguid',
    });
    await app.mikro.em.persist(passkey).flush();
    passkeyId = passkey.id;
  });

  return passkeyId;
}

/**
 * Helper to link an OAuth account to a user
 */
async function linkOAuthAccount(userId: string): Promise<void> {
  await withMikroContext(app, async () => {
    const user = await app.mikro.user.findOneOrFail({ id: userId });
    const oauthAccount = app.mikro.userOAuth.create({
      user,
      provider_name: 'google',
      provider_user_id: `google-${crypto.randomUUID()}`,
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: null,
    });
    await app.mikro.em.persist(oauthAccount).flush();
  });
}

describe('DELETE /api/v1/user/passkeys/:id', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 404 when passkey does not exist', async () => {
    const email = generateUniqueEmail('passkey-delete-not-found');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should successfully delete passkey when user has password', async () => {
    const email = generateUniqueEmail('passkey-delete-with-password');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Test Passkey');

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify passkey was deleted
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
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

    const passkeyId1 = await createPasskeyForUser(userId, 'Passkey 1');
    const passkeyId2 = await createPasskeyForUser(userId, 'Passkey 2');

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId1}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify first passkey was deleted
    await withMikroContext(app, async () => {
      const passkey1 = await app.mikro.userPasskey.findOne({ id: passkeyId1 });
      expect(passkey1).toBeNull();

      // Second passkey should still exist
      const passkey2 = await app.mikro.userPasskey.findOne({ id: passkeyId2 });
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
    const passkeyId = await createPasskeyForUser(userId2, 'User2 Passkey');

    // User1 tries to delete user2's passkey
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId}`,
      },
      session1,
    );

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');

    // Verify the passkey was NOT deleted
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey).not.toBeNull();
    });
  });

  test('should return 400 when id is not a valid UUID', async () => {
    const email = generateUniqueEmail('passkey-delete-invalid-uuid');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/passkeys/not-a-uuid',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
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
    const passkeyId = await createPasskeyForUser(userId, 'Only Passkey');

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify passkey was deleted
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
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
    await createPasskeyForUser(userId, 'Passkey 1');
    const passkeyId2 = await createPasskeyForUser(userId, 'Passkey 2');

    // Delete second passkey (not the last one)
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId2}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
  });

  test('should work for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Get user ID from session
    const sessionRes = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    const userId = sessionRes.json().user.id;

    // Create passkey for config user
    const passkeyId = await createPasskeyForUser(userId, 'Config User Passkey');

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  test('should delete all passkeys sequentially when user has password', async () => {
    const email = generateUniqueEmail('passkey-delete-all-with-password');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId1 = await createPasskeyForUser(userId, 'Passkey 1');
    const passkeyId2 = await createPasskeyForUser(userId, 'Passkey 2');
    const passkeyId3 = await createPasskeyForUser(userId, 'Passkey 3');

    // Delete all passkeys one by one
    for (const passkeyId of [passkeyId1, passkeyId2, passkeyId3]) {
      const res = await injectWithSession(
        app,
        {
          method: 'DELETE',
          url: `/api/v1/user/passkeys/${passkeyId}`,
        },
        sessionCookie,
      );
      expect(res.statusCode).toBe(200);
    }

    // Verify all passkeys are deleted
    await withMikroContext(app, async () => {
      const passkeys = await app.mikro.userPasskey.findByUserId(userId);
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

    const passkeyId = await createPasskeyForUser(userId, 'Test Passkey');

    // Send two concurrent delete requests
    const [res1, res2] = await Promise.all([
      injectWithSession(
        app,
        {
          method: 'DELETE',
          url: `/api/v1/user/passkeys/${passkeyId}`,
        },
        sessionCookie,
      ),
      injectWithSession(
        app,
        {
          method: 'DELETE',
          url: `/api/v1/user/passkeys/${passkeyId}`,
        },
        sessionCookie,
      ),
    ]);

    // One should succeed, one should fail with 404
    const statusCodes = [res1.statusCode, res2.statusCode].sort();
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

    const passkeyId1 = await createPasskeyForUser(userId, 'Passkey 1');
    await createPasskeyForUser(userId, 'Passkey 2');

    // Get initial list
    const listBefore = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );
    expect(listBefore.json().passkeys).toHaveLength(2);

    // Delete one passkey
    await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId1}`,
      },
      sessionCookie,
    );

    // Get updated list
    const listAfter = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );
    expect(listAfter.json().passkeys).toHaveLength(1);
    expect(listAfter.json().passkeys[0].name).toBe('Passkey 2');
  });
});

describe('DELETE /api/v1/user/passkeys/:id - Last auth method protection', () => {
  test('should prevent deleting last passkey when no other auth methods exist', async () => {
    const email = generateUniqueEmail('passkey-delete-last-only');
    const password = 'testPassword123!';

    // Create user with password
    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Remove password from user
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail(
        { id: userId },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await app.mikro.em.flush();
    });

    // Create only one passkey
    const passkeyId = await createPasskeyForUser(
      userId,
      'Only Auth Method Passkey',
    );

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('CANNOT_REMOVE_LAST_PASSKEY');

    // Verify passkey was NOT deleted
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
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
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail(
        { id: userId },
        { populate: ['password_hash'] },
      );
      user.password_hash = null;
      await app.mikro.em.flush();
    });

    // Create multiple passkeys
    const passkeyId1 = await createPasskeyForUser(userId, 'Passkey 1');
    await createPasskeyForUser(userId, 'Passkey 2');

    // Should be able to delete one (still has another)
    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: `/api/v1/user/passkeys/${passkeyId1}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });
});

describe('DELETE /api/v1/user/passkeys/:id - Passkey disabled', () => {
  const appDisabled = setupTestServer({
    configOverrides: {
      authentication_methods: {
        password: {
          type: 'password',
          enabled: true,
          email_verification: true,
          passkey: {
            enabled: false,
            required: false,
          },
        },
      },
    },
  });

  test('should return 400 when passkey is disabled in config', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const res = await injectWithSession(
      appDisabled,
      {
        method: 'DELETE',
        url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_ENABLED');
  });
});
