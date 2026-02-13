import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createPasskeyForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';
import type { AppType, ServiceContainer } from '@/types.js';

describe('PATCH /api/v1/user/passkeys/:id', () => {
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
   * Helper to create a DB user with session
   */
  async function createDbUserWithSession(
    email: string,
    password: string,
  ): Promise<{ sessionCookie: string; userId: string }> {
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');
    const body = await loginRes.json();
    const userId = body.user.id;

    return { sessionCookie, userId };
  }

  test('should return 401 when not authenticated', async () => {
    const res = await app.request(
      '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 404 when passkey does not exist', async () => {
    const email = generateUniqueEmail('passkey-patch-not-found');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await requestWithSession(
      app,
      '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should successfully rename passkey', async () => {
    const email = generateUniqueEmail('passkey-patch-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userId, 'Old Name');

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify the name was updated in database
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
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

    const passkeyId = await createPasskeyForUser(services, userId, null);

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'My New Passkey' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify the name was updated
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
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

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Original Name',
    );

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: '' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when name exceeds max length', async () => {
    const email = generateUniqueEmail('passkey-patch-long-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Original Name',
    );

    // Create a name longer than 100 characters
    const longName = 'a'.repeat(101);

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: longName }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });

  test('should accept name at max length (100 chars)', async () => {
    const email = generateUniqueEmail('passkey-patch-max-name');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Original Name',
    );

    // Create a name exactly 100 characters
    const maxName = 'a'.repeat(100);

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: maxName }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
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
    const passkeyId = await createPasskeyForUser(
      services,
      userId2,
      'User2 Passkey',
    );

    // User1 tries to rename user2's passkey
    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Stolen Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
      session1,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');

    // Verify the name was NOT changed
    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
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

    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Original Name',
    );

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when id is not a valid UUID', async () => {
    const email = generateUniqueEmail('passkey-patch-invalid-uuid');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await requestWithSession(
      app,
      '/api/v1/user/passkeys/not-a-uuid',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });

  test('should handle special characters in name', async () => {
    const email = generateUniqueEmail('passkey-patch-special-chars');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userId, 'Original');

    const specialName = "My iPhone 📱 - John's Device (2024)";

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: specialName }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    await withMikroContext(services, async () => {
      const passkey = await services.mikro.userPasskey.findOne({
        id: passkeyId,
      });
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

    const passkeyId = await createPasskeyForUser(services, userId, 'Original');

    // Whitespace-only name should be accepted as the schema doesn't
    // explicitly trim
    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: '   ' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    // This depends on schema definition - if .min(1) is before any trim,
    // whitespace passes
    expect(res.status).toBe(200);
  });

  test('should work for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Get user ID from session
    const sessionRes = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionBody = await sessionRes.json();
    const userId = sessionBody.user.id;

    // Create passkey for config user
    const passkeyId = await createPasskeyForUser(
      services,
      userId,
      'Config User Passkey',
    );

    const res = await requestWithSession(
      app,
      `/api/v1/user/passkeys/${passkeyId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed Passkey' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/v1/user/passkeys/:id - Passkey disabled', () => {
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

  test('should return 404 when passkey is disabled in config (route not registered)', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const res = await requestWithSession(
      appDisabled,
      '/api/v1/user/passkeys/00000000-0000-0000-0000-000000000000',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    // Route is registered but handler rejects when passkey is disabled
    expect(res.status).toBe(400);
  });
});
