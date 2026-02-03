import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createDbUserWithSession,
  enableTotpForUser,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          totp: {
            enabled: true,
          },
        },
      },
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/auth/totp/verify', () => {
  test('should complete login with valid TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    const secret = await enableTotpForUser(app, userId);

    // Login with password - should get 2fa_required status
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody).toHaveProperty('user');
    expect(loginBody.user.totp_registered).toBe(true);

    // Get session cookie from login response
    const sessionCookie = extractCookie(loginRes, 'session');

    // Generate valid TOTP code
    const validCode = app.totpService.generateToken(secret);

    // Verify TOTP code
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: sessionCookie },
      payload: { code: validCode },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody).toHaveProperty('user');
    expect(verifyBody.user.id).toBe(userId);
    expect(verifyBody.user.email).toBe(email);
    expect(verifyBody.user.totp_registered).toBe(true);
  });

  test('should fail with invalid TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-invalid');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    // Login with password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with invalid code
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: sessionCookie },
      payload: { code: '000000' },
    });

    expectError(verifyRes, e.InvalidTotpCode);
  });

  test('should fail without pending TOTP session', async () => {
    // Try to verify TOTP without logging in first
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      payload: { code: '123456' },
    });

    expectError(verifyRes, e.SecondFactorSessionExpired);
  });

  test('should fail with malformed TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-malformed');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    // Login with password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with malformed code (not 6 digits)
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: sessionCookie },
      payload: { code: '12345' }, // Only 5 digits
    });

    expect(verifyRes.statusCode).toBe(400);
  });

  test('should not allow access to protected routes with pending TOTP session', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-pending-protected');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    // Login with password (creates pending TOTP session)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access a protected route (session endpoint) with pending TOTP
    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/user/session',
      cookies: { session: sessionCookie },
    });

    // Should return unauthenticated status since session is not complete
    expect(sessionRes.statusCode).toBe(200);
    const body = sessionRes.json();
    expect(body).not.toHaveProperty('user');
  });

  test('should allow access to protected routes after successful TOTP verification', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-protected-access');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    const secret = await enableTotpForUser(app, userId);

    // Login with password (creates pending TOTP session)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const pendingSessionCookie = extractCookie(loginRes, 'session');

    // Verify TOTP code
    const validCode = app.totpService.generateToken(secret);
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: pendingSessionCookie },
      payload: { code: validCode },
    });
    expect(verifyRes.statusCode).toBe(200);

    // Get the new session cookie from verify response
    const authenticatedCookie = extractCookie(verifyRes, 'session');

    // Now access protected route (session endpoint) with authenticated session
    const sessionRes = await app.inject({
      method: 'GET',
      url: '/api/v1/user/session',
      cookies: { session: authenticatedCookie },
    });

    expect(sessionRes.statusCode).toBe(200);
    const body = sessionRes.json();
    expect(body).toHaveProperty('user');
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(email);
    expect(body.user.totp_registered).toBe(true);
  });

  test('should return 400 when body is empty', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-empty-body');
    const password = 'password123';

    // Create user with verified email
    const { userId } = await createDbUserWithSession(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    // Login with password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with empty body
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: sessionCookie },
      payload: {},
    });

    expect(verifyRes.statusCode).toBe(400);
  });
});

// Note: Login TOTP flow tests are in the dedicated login/post.totp.test.ts file
