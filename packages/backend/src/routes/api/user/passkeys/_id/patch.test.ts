import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { createServer } from '#backend/server.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createPasskeyForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('PATCH /api/user/passkeys/:id', () => {
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
  ): Promise<{
    sessionCookie: string;
    userSub: string;
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
    const userSub = body.user.sub;

    return { sessionCookie, userSub };
  }

  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch({
      param: {
        id: '00000000-0000-0000-0000-000000000000',
      },
      json: { name: 'New Name' },
    });

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 404 when passkey does not exist', async () => {
    const email = generateUniqueEmail('passkey-patch-not-found');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: {
          id: '00000000-0000-0000-0000-000000000000',
        },
        json: { name: 'New Name' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 404);
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should successfully rename passkey', async () => {
    const email = generateUniqueEmail('passkey-patch-success');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userSub, 'Old Name');

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: 'New Name' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userSub, null);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: 'My New Passkey' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userSub,
      'Original Name',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: '' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when name exceeds max length', async () => {
    const email = generateUniqueEmail('passkey-patch-long-name');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userSub,
      'Original Name',
    );

    // Create a name longer than 100 characters
    const longName = 'a'.repeat(101);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: longName },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should accept name at max length (100 chars)', async () => {
    const email = generateUniqueEmail('passkey-patch-max-name');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userSub,
      'Original Name',
    );

    // Create a name exactly 100 characters
    const maxName = 'a'.repeat(100);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: maxName },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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
    const { userSub: userSub2 } = await createDbUserWithSession(
      email2,
      password,
    );

    // Create passkey for user2
    const passkeyId = await createPasskeyForUser(
      services,
      userSub2,
      'User2 Passkey',
    );

    // User1 tries to rename user2's passkey
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: 'Stolen Name' },
      },
      { headers: { Cookie: `session=${session1}` } },
    );

    const body = await assertJsonBody(res, 404);
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

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(
      services,
      userSub,
      'Original Name',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when id is not a valid UUID', async () => {
    const email = generateUniqueEmail('passkey-patch-invalid-uuid');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: 'not-a-uuid' },
        json: { name: 'New Name' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should handle special characters in name', async () => {
    const email = generateUniqueEmail('passkey-patch-special-chars');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userSub, 'Original');

    const specialName = "My iPhone 📱 - John's Device (2024)";

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: specialName },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    const passkeyId = await createPasskeyForUser(services, userSub, 'Original');

    // Whitespace-only name should be accepted as the schema doesn't
    // explicitly trim
    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: '   ' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // This depends on schema definition - if .min(1) is before any trim,
    // whitespace passes
    expect(res.status).toBe(200);
  });

  test('should work for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    // Get user ID from session
    const sessionClient = testClient(app);
    const sessionRes = await sessionClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    if (!sessionBody.user) return;
    const userSub = sessionBody.user.sub;

    // Create passkey for config user
    const passkeyId = await createPasskeyForUser(
      services,
      userSub,
      'Config User Passkey',
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: { id: passkeyId },
        json: { name: 'Renamed Passkey' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/user/passkeys/:id - Passkey disabled', () => {
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
    const res = await client.api.user.passkeys[':id'].$patch(
      {
        param: {
          id: '00000000-0000-0000-0000-000000000000',
        },
        json: { name: 'New Name' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Route is registered but handler rejects when passkey is disabled
    expect(res.status).toBe(400);
  });
});
