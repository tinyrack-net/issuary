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
    basic_authentication_methods: {
      passkey: {
        enabled: true,
        email_verification: true,
      },
    },
  },
});

/**
 * Helper to create a DB user with session
 */
async function createDbUserWithSession(
  email: string,
  password: string,
): Promise<{ sessionCookie: string; userId: string }> {
  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password,
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

describe('PATCH /api/v1/user/passkeys/:id', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 404 when passkey does not exist', async () => {
    const email = generateUniqueEmail('passkey-patch-not-found');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
        payload: { name: 'New Name' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should successfully rename passkey', async () => {
    const email = generateUniqueEmail('passkey-patch-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Old Name');

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: 'New Name' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    // Verify the name was updated in database
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey?.name).toBe('New Name');
    });
  });

  test('should rename passkey from null to a name', async () => {
    const email = generateUniqueEmail('passkey-patch-null-to-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, null);

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: 'My New Passkey' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    // Verify the name was updated
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey?.name).toBe('My New Passkey');
    });
  });

  test('should return 400 when name is empty', async () => {
    const email = generateUniqueEmail('passkey-patch-empty-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original Name');

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: '' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should return 400 when name exceeds max length', async () => {
    const email = generateUniqueEmail('passkey-patch-long-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original Name');

    // Create a name longer than 100 characters
    const longName = 'a'.repeat(101);

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: longName },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should accept name at max length (100 chars)', async () => {
    const email = generateUniqueEmail('passkey-patch-max-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original Name');

    // Create a name exactly 100 characters
    const maxName = 'a'.repeat(100);

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: maxName },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey?.name).toBe(maxName);
    });
  });

  test('should not allow renaming another user passkey', async () => {
    const email1 = generateUniqueEmail('passkey-patch-user1');
    const email2 = generateUniqueEmail('passkey-patch-user2');
    const password = 'testPassword123!';

    const { sessionCookie: session1 } = await createDbUserWithSession(
      email1,
      password,
    );
    const { userId: userId2 } = await createDbUserWithSession(email2, password);

    // Create passkey for user2
    const passkeyId = await createPasskeyForUser(userId2, 'User2 Passkey');

    // User1 tries to rename user2's passkey
    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: 'Stolen Name' },
      },
      session1,
    );

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');

    // Verify the name was NOT changed
    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey?.name).toBe('User2 Passkey');
    });
  });

  test('should return 400 when name is missing from body', async () => {
    const email = generateUniqueEmail('passkey-patch-no-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original Name');

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: {},
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should return 400 when id is not a valid UUID', async () => {
    const email = generateUniqueEmail('passkey-patch-invalid-uuid');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: '/api/v1/user/passkeys/not-a-uuid',
        payload: { name: 'New Name' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should handle special characters in name', async () => {
    const email = generateUniqueEmail('passkey-patch-special-chars');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original');

    const specialName = "My iPhone 📱 - John's Device (2024)";

    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: specialName },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    await withMikroContext(app, async () => {
      const passkey = await app.mikro.userPasskey.findOne({ id: passkeyId });
      expect(passkey?.name).toBe(specialName);
    });
  });

  test('should handle whitespace-only name appropriately', async () => {
    const email = generateUniqueEmail('passkey-patch-whitespace');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(userId, 'Original');

    // Whitespace-only name should be accepted as the schema doesn't
    // explicitly trim
    const res = await injectWithSession(
      app,
      {
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: '   ' },
      },
      sessionCookie,
    );

    // This depends on schema definition - if .min(1) is before any trim,
    // whitespace passes
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
        method: 'PATCH',
        url: `/api/v1/user/passkeys/${passkeyId}`,
        payload: { name: 'Renamed Passkey' },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/v1/user/passkeys/:id - Passkey disabled', () => {
  const appDisabled = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        passkey: {
          enabled: false,
          email_verification: true,
        },
      },
    },
  });

  test('should return 404 when passkey is disabled in config (route not registered)', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const res = await injectWithSession(
      appDisabled,
      {
        method: 'PATCH',
        url: '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
        payload: { name: 'New Name' },
      },
      sessionCookie,
    );

    // When passkey is disabled, the route is not registered at all
    expect(res.statusCode).toBe(404);
  });
});
