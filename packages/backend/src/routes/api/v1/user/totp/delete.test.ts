import { generateSecret, generateSync } from 'otplib';
import { describe, expect, test } from 'vitest';
import {
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

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

  const sessionCookie = loginRes.cookies.find((c) => c.name === 'session')
    ?.value as string;
  expect(sessionCookie).toBeDefined();

  const userId = loginRes.json().user.id as string;

  return { sessionCookie, userId };
}

/**
 * Helper to enable TOTP for a user and return the secret
 */
async function enableTotpForUser(userId: string): Promise<string> {
  const secret = generateSecret();

  await withMikroContext(app, async () => {
    const user = await app.mikro.user.findOneOrFail({ id: userId });
    const totp = app.mikro.userTotp.create({
      user,
      secret,
    });
    totp.verified = true;
    await app.mikro.em.persist(totp).flush();
  });

  return secret;
}

describe('DELETE /api/v1/user/totp', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/user/totp',
      payload: {
        code: '123456',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return 400 when TOTP is not enabled', async () => {
    const email = generateUniqueEmail('totp-delete-not-enabled');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '123456',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('TOTP_NOT_ENABLED');
  });

  test('should return 400 when code is invalid', async () => {
    const email = generateUniqueEmail('totp-delete-invalid-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP
    await enableTotpForUser(userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '000000',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_TOTP_CODE');
  });

  test('should successfully disable TOTP with valid code', async () => {
    const email = generateUniqueEmail('totp-delete-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(userId);

    // Generate valid code
    const validCode = generateSync({ secret });

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify TOTP is removed from database
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp).toBeNull();
    });
  });

  test('should validate code format - non-numeric', async () => {
    const email = generateUniqueEmail('totp-delete-format-nonnumeric');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    await enableTotpForUser(userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: 'abcdef',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should validate code format - wrong length', async () => {
    const email = generateUniqueEmail('totp-delete-format-length');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    await enableTotpForUser(userId);

    // Too short
    const res1 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '12345',
        },
      },
      sessionCookie,
    );
    expect(res1.statusCode).toBe(400);

    // Too long
    const res2 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '1234567',
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(400);
  });

  test('should update session to reflect TOTP disabled status', async () => {
    const email = generateUniqueEmail('totp-delete-session-update');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(userId);

    // Check initial session - TOTP should be enabled
    const sessionBefore = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionBefore.json().user.totp_enabled).toBe(true);

    // Disable TOTP
    const validCode = generateSync({ secret });
    await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    // Check session after - TOTP should be disabled
    const sessionAfter = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionAfter.json().user.totp_enabled).toBe(false);
  });

  test('should not disable TOTP with unverified setup', async () => {
    const email = generateUniqueEmail('totp-delete-unverified');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Create unverified TOTP record
    const secret = generateSecret();
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret,
      });
      totp.verified = false;
      await app.mikro.em.persist(totp).flush();
    });

    const validCode = generateSync({ secret });

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('TOTP_NOT_ENABLED');
  });

  test('should prevent replay attacks with same code', async () => {
    const email = generateUniqueEmail('totp-delete-replay');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(userId);
    const validCode = generateSync({ secret });

    // First deletion should succeed
    const res1 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );
    expect(res1.statusCode).toBe(200);

    // Second deletion with same code should fail (TOTP no longer enabled)
    const res2 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(400);
    expect(res2.json().code).toBe('TOTP_NOT_ENABLED');
  });

  test('should allow re-enabling TOTP after disabling', async () => {
    const email = generateUniqueEmail('totp-delete-reenable');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP
    const secret1 = await enableTotpForUser(userId);
    const validCode1 = generateSync({ secret: secret1 });

    // Disable TOTP
    const disableRes = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode1,
        },
      },
      sessionCookie,
    );
    expect(disableRes.statusCode).toBe(200);

    // Start new setup
    const setupRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );
    expect(setupRes.statusCode).toBe(200);
    const newSecret = setupRes.json().secret;

    // Verify new setup
    const newCode = generateSync({ secret: newSecret });
    const verifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: newCode,
        },
      },
      sessionCookie,
    );
    expect(verifyRes.statusCode).toBe(200);

    // Verify TOTP is enabled again
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findVerifiedByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.secret).toBe(newSecret);
    });
  });

  test('should require code in request body', async () => {
    const email = generateUniqueEmail('totp-delete-no-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    await enableTotpForUser(userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {},
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });
});
