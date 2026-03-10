import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createPasskeyForUser,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('GET /api/user/passkeys', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
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
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
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
    const res = await client.api.user.passkeys.$get();

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return empty array when user has no passkeys', async () => {
    const email = generateUniqueEmail('passkey-get-empty');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toEqual([]);
  });

  test('should return single passkey when user has one', async () => {
    const email = generateUniqueEmail('passkey-get-single');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    // Create a passkey
    await createPasskeyForUser(services, userSub, 'My MacBook');

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(1);
    const passkey = body.passkeys[0];
    expect(passkey).toBeDefined();
    if (!passkey) return;
    expect(passkey.name).toBe('My MacBook');
    expect(passkey.device_type).toBe('multiDevice');
    expect(passkey.backed_up).toBe(true);
    expect(passkey.id).toBeDefined();
    expect(passkey.credential_id).toBeDefined();
    expect(passkey.created_at).toBeDefined();
  });

  test('should return multiple passkeys when user has many', async () => {
    const email = generateUniqueEmail('passkey-get-multiple');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    // Create multiple passkeys
    await createPasskeyForUser(services, userSub, 'MacBook Pro');
    await createPasskeyForUser(services, userSub, 'iPhone');
    await createPasskeyForUser(services, userSub, null);

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(3);

    // Verify passkey names (order may vary due to DESC order by created_at)
    const names = body.passkeys.map((p: { name: string | null }) => p.name);
    expect(names).toContain('MacBook Pro');
    expect(names).toContain('iPhone');
    expect(names).toContain(null);
  });

  test('should not expose sensitive data like public_key', async () => {
    const email = generateUniqueEmail('passkey-get-no-sensitive');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    await createPasskeyForUser(services, userSub, 'Test Device');

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(1);
    const passkey = body.passkeys[0];
    expect(passkey).toBeDefined();
    if (!passkey) return;

    // Should NOT expose sensitive fields
    expect('public_key' in passkey).toBe(false);
    expect('counter' in passkey).toBe(false);
    expect('transports' in passkey).toBe(false);
    expect('aaguid' in passkey).toBe(false);
  });

  test('should return passkeys sorted by created_at descending', async () => {
    const email = generateUniqueEmail('passkey-get-sorted');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    // Create passkeys with slight delay to ensure different timestamps
    await createPasskeyForUser(services, userSub, 'First Device');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createPasskeyForUser(services, userSub, 'Second Device');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createPasskeyForUser(services, userSub, 'Third Device');

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(3);

    // Most recent should be first (DESC order)
    expect(body.passkeys[0]?.name).toBe('Third Device');
    expect(body.passkeys[1]?.name).toBe('Second Device');
    expect(body.passkeys[2]?.name).toBe('First Device');
  });

  test('should work for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(Array.isArray(body.passkeys)).toBe(true);
  });

  test('should only return passkeys belonging to authenticated user', async () => {
    const email1 = generateUniqueEmail('passkey-get-user1');
    const email2 = generateUniqueEmail('passkey-get-user2');
    const password = 'testPassword123!';

    const { sessionCookie: session1, userSub: userSub1 } =
      await createDbUserWithSession(email1, password);
    const { userSub: userSub2 } = await createDbUserWithSession(
      email2,
      password,
    );

    // Create passkeys for both users
    await createPasskeyForUser(services, userSub1, 'User1 Device');
    await createPasskeyForUser(services, userSub2, 'User2 Device');

    // User 1 should only see their passkey
    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${session1}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(1);
    expect(body.passkeys[0]?.name).toBe('User1 Device');
  });

  test('should return correct device_type values', async () => {
    const email = generateUniqueEmail('passkey-get-device-types');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      email,
      password,
    );

    // Create passkeys with different device types
    await withMikroContext(services, async () => {
      const passkey1 = services.mikro.userPasskey.create({
        user: userSub,
        credential_id: `test-single-${crypto.randomUUID()}`,
        public_key: 'test-public-key-1',
        counter: 0,
        device_type: 'singleDevice',
        backed_up: false,
        name: 'Single Device',
      });

      const passkey2 = services.mikro.userPasskey.create({
        user: userSub,
        credential_id: `test-multi-${crypto.randomUUID()}`,
        public_key: 'test-public-key-2',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        name: 'Multi Device',
      });

      await services.mikro.em.persist([passkey1, passkey2]).flush();
    });

    const client = testClient(app);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    expect(body.passkeys).toHaveLength(2);

    const deviceTypes = body.passkeys.map(
      (p: { device_type: string }) => p.device_type,
    );
    expect(deviceTypes).toContain('singleDevice');
    expect(deviceTypes).toContain('multiDevice');
  });
});

describe('GET /api/user/passkeys - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
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

  test('should return 400 when passkey is disabled', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const client = testClient(appDisabled);
    const res = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.PasskeyNotEnabled);
  });
});
