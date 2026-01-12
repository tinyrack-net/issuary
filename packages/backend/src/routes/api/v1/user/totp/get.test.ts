import { generateSecret } from 'otplib';
import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
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
): Promise<string> {
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

  return sessionCookie;
}

/**
 * Helper to enable TOTP for a user
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

describe('GET /api/v1/user/totp', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/user/totp',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return enabled: false when TOTP is not set up', async () => {
    const email = generateUniqueEmail('totp-get-not-setup');
    const password = 'testPassword123!';

    const sessionCookie = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/totp',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
  });

  test('should return enabled: true when TOTP is enabled', async () => {
    const email = generateUniqueEmail('totp-get-enabled');
    const password = 'testPassword123!';

    const sessionCookie = await createDbUserWithSession(email, password);

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

    // Enable TOTP
    await enableTotpForUser(userId);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/totp',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(true);
  });

  test('should return enabled: false when TOTP is set up but not verified', async () => {
    const email = generateUniqueEmail('totp-get-unverified');
    const password = 'testPassword123!';

    const sessionCookie = await createDbUserWithSession(email, password);

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

    // Create unverified TOTP record
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret: generateSecret(),
      });
      totp.verified = false;
      await app.mikro.em.persist(totp).flush();
    });

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/totp',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
  });

  test('should work for config-managed users', async () => {
    // Config users can still check TOTP status
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/totp',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.enabled).toBe('boolean');
  });
});
