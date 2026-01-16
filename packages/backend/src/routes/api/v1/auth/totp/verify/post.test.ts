import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  createDbUserWithSession,
  enableTotpForUser,
  expectError,
  extractCookie,
  generateUniqueEmail,
  setupTestServer,
} from '@/test-utils/index.js';

const app = setupTestServer({
  configOverrides: {
    basic_authentication_methods: {
      password: {
        totp: {
          enabled: true,
          required: false,
        },
      },
    },
  },
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

    // Login with password - should get second_factor_required
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.second_factor_required).toBe(true);
    expect(loginBody).not.toHaveProperty('user');

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
    expect(verifyBody.user.totp_enabled).toBe(true);
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

    // Should return null user since session is not complete
    expect(sessionRes.statusCode).toBe(200);
    const body = sessionRes.json();
    expect(body.user).toBeNull();
  });
});

describe('POST /api/v1/auth/login - TOTP flow', () => {
  test('should return second_factor_required for TOTP-enabled user', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-login-required');
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
    const body = loginRes.json();
    expect(body.second_factor_required).toBe(true);
    expect(body).not.toHaveProperty('user');
  });

  test('should complete login immediately for non-TOTP user', async () => {
    // Create a user without TOTP (email verified)
    const email = generateUniqueEmail('totp-login-not-required');
    const password = 'password123';

    // Create user with verified email
    await createDbUserWithSession(app, email, password);

    // Login with password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.second_factor_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(email);
  });
});
