import { generateSecret, generateSync, verifySync } from 'otplib';
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

describe('POST /api/v1/user/totp/setup', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/totp/setup',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return secret, otpauth_url, and qr_code on successful setup', async () => {
    const email = generateUniqueEmail('totp-setup-success');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify response structure
    expect(body.secret).toBeDefined();
    expect(typeof body.secret).toBe('string');
    expect(body.secret.length).toBeGreaterThan(10);

    expect(body.otpauth_url).toBeDefined();
    expect(body.otpauth_url).toContain('otpauth://totp/');
    expect(body.otpauth_url).toContain(encodeURIComponent(email));
    expect(body.otpauth_url).toContain(body.secret);

    expect(body.qr_code).toBeDefined();
    expect(body.qr_code).toMatch(/^data:image\/png;base64,/);
  });

  test('should create unverified TOTP record in database', async () => {
    const email = generateUniqueEmail('totp-setup-db-record');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify database record
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.secret).toBe(body.secret);
      expect(totp?.verified).toBe(false);
    });
  });

  test('should regenerate secret on repeated setup calls', async () => {
    const email = generateUniqueEmail('totp-setup-regenerate');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    // First setup call
    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res1.statusCode).toBe(200);
    const firstSecret = res1.json().secret;

    // Second setup call should regenerate secret
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res2.statusCode).toBe(200);
    const secondSecret = res2.json().secret;

    // Secrets should be different
    expect(secondSecret).not.toBe(firstSecret);
  });

  test('should return 409 when TOTP is already enabled', async () => {
    const email = generateUniqueEmail('totp-setup-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      email,
      password,
    );

    // Enable TOTP directly in database
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret: generateSecret(),
      });
      totp.verified = true;
      await app.mikro.em.persist(totp).flush();
    });

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe('TOTP_ALREADY_ENABLED');
  });

  test('should work for config users (synced to DB)', async () => {
    // Config users are now synced to DB, so TOTP setup should work
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    // Should return 200 since config users are synced to DB
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.secret).toBeDefined();
    expect(body.otpauth_url).toBeDefined();
    expect(body.qr_code).toBeDefined();
  });

  test('should generate valid OTP auth URL that works with authenticator', async () => {
    const email = generateUniqueEmail('totp-setup-valid-otp');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(email, password);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Generate a valid token using the secret
    const validToken = generateSync({ secret: body.secret });
    expect(validToken).toMatch(/^\d{6}$/);

    // Verify the token is valid
    const result = verifySync({
      token: validToken,
      secret: body.secret,
    });
    expect(result.valid).toBe(true);
  });
});
