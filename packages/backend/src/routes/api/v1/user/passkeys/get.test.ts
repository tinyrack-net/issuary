import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createPasskeyForUser,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

describe('GET /api/v1/user/passkeys', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
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
  });

  afterAll(async () => {
    await app.close();
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

  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/user/passkeys',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return empty array when user has no passkeys', async () => {
    const email = generateUniqueEmail('passkey-get-empty');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toEqual([]);
  });

  test('should return single passkey when user has one', async () => {
    const email = generateUniqueEmail('passkey-get-single');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create a passkey
    await createPasskeyForUser(app, userId, 'My MacBook');

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toHaveLength(1);
    expect(body.passkeys[0].name).toBe('My MacBook');
    expect(body.passkeys[0].device_type).toBe('multiDevice');
    expect(body.passkeys[0].backed_up).toBe(true);
    expect(body.passkeys[0].id).toBeDefined();
    expect(body.passkeys[0].credential_id).toBeDefined();
    expect(body.passkeys[0].created_at).toBeDefined();
  });

  test('should return multiple passkeys when user has many', async () => {
    const email = generateUniqueEmail('passkey-get-multiple');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create multiple passkeys
    await createPasskeyForUser(app, userId, 'MacBook Pro');
    await createPasskeyForUser(app, userId, 'iPhone');
    await createPasskeyForUser(app, userId, null);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
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

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    await createPasskeyForUser(app, userId, 'Test Device');

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toHaveLength(1);

    // Should NOT expose sensitive fields
    expect(body.passkeys[0].public_key).toBeUndefined();
    expect(body.passkeys[0].counter).toBeUndefined();
    expect(body.passkeys[0].transports).toBeUndefined();
    expect(body.passkeys[0].aaguid).toBeUndefined();
  });

  test('should return passkeys sorted by created_at descending', async () => {
    const email = generateUniqueEmail('passkey-get-sorted');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create passkeys with slight delay to ensure different timestamps
    await createPasskeyForUser(app, userId, 'First Device');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createPasskeyForUser(app, userId, 'Second Device');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createPasskeyForUser(app, userId, 'Third Device');

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toHaveLength(3);

    // Most recent should be first (DESC order)
    expect(body.passkeys[0].name).toBe('Third Device');
    expect(body.passkeys[1].name).toBe('Second Device');
    expect(body.passkeys[2].name).toBe('First Device');
  });

  test('should work for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.passkeys)).toBe(true);
  });

  test('should only return passkeys belonging to authenticated user', async () => {
    const email1 = generateUniqueEmail('passkey-get-user1');
    const email2 = generateUniqueEmail('passkey-get-user2');
    const password = 'testPassword123!';

    const { sessionCookie: session1, userId: userId1 } =
      await createDbUserWithSession(email1, password);
    const { userId: userId2 } = await createDbUserWithSession(email2, password);

    // Create passkeys for both users
    await createPasskeyForUser(app, userId1, 'User1 Device');
    await createPasskeyForUser(app, userId2, 'User2 Device');

    // User 1 should only see their passkey
    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      session1,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toHaveLength(1);
    expect(body.passkeys[0].name).toBe('User1 Device');
  });

  test('should return correct device_type values', async () => {
    const email = generateUniqueEmail('passkey-get-device-types');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create passkeys with different device types
    await withMikroContext(app, async () => {
      const passkey1 = app.mikro.userPasskey.create({
        user: userId,
        credential_id: `test-single-${crypto.randomUUID()}`,
        public_key: 'test-public-key-1',
        counter: 0,
        device_type: 'singleDevice',
        backed_up: false,
        name: 'Single Device',
      });

      const passkey2 = app.mikro.userPasskey.create({
        user: userId,
        credential_id: `test-multi-${crypto.randomUUID()}`,
        public_key: 'test-public-key-2',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        name: 'Multi Device',
      });

      await app.mikro.em.persist([passkey1, passkey2]).flush();
    });

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/passkeys',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passkeys).toHaveLength(2);

    const deviceTypes = body.passkeys.map(
      (p: { device_type: string }) => p.device_type,
    );
    expect(deviceTypes).toContain('singleDevice');
    expect(deviceTypes).toContain('multiDevice');
  });
});
