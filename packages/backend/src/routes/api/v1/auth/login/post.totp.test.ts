/**
 * TOTP-related login tests.
 *
 * Tests various TOTP configuration combinations:
 * - TOTP Required Mode (enabled: true, required: true)
 * - TOTP Optional Mode (enabled: true, required: false)
 * - TOTP Disabled Mode (enabled: false)
 * - Email Verification + TOTP combinations
 * - Session state verification
 *
 * Note: The login logic works as follows:
 * - If user.totp_enabled (has TOTP registered in DB) => TOTP verification required (regardless of config)
 * - If user.totp_required (config says TOTP is required) && !user.totp_enabled => TOTP setup required
 * - Otherwise => immediate login success
 */

import type { FastifyInstance } from 'fastify';
import { describe, expect, test } from 'vitest';
import { TEST_USER } from '@/test-utils/fixtures.js';
import {
  enableTotpForUser,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

/**
 * Helper function to create a user in DB without triggering login flow.
 * Returns userId for further operations.
 */
async function createUserInDb(
  app: FastifyInstance,
  email: string,
  password: string,
  options: { emailVerified?: boolean } = {},
): Promise<string> {
  const { emailVerified = true } = options;
  let userId = '';

  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password,
    });
    user.email_verified = emailVerified;
    await app.mikro.em.persist(user).flush();
    userId = user.id;
  });

  return userId;
}

/**
 * =============================================================================
 * TOTP Required Mode Tests
 * Config: totp.enabled = true, totp.required = true
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Required Mode', () => {
  const app = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        password: {
          email_verification: false, // Disable email verification to isolate TOTP tests
          totp: {
            enabled: true,
            required: true,
          },
        },
      },
    },
  });

  test('should require TOTP setup for user without TOTP registered', async () => {
    const email = generateUniqueEmail('totp-required-no-totp');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();
    });

    // Login should return totp_setup_required
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.totp_setup_required).toBe(true);
    expect(body.totp_verification_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).not.toHaveProperty('user');
  });

  test('should require TOTP verification for user with TOTP registered', async () => {
    const email = generateUniqueEmail('totp-required-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    // Login should return totp_verification_required
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.totp_verification_required).toBe(true);
    expect(body.totp_setup_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).not.toHaveProperty('user');
  });

  test('should issue pendingTotpSetup session when TOTP setup is required', async () => {
    const email = generateUniqueEmail('totp-required-pending-setup');
    const password = 'password123';

    // Create user without TOTP
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
    expect(loginRes.json().totp_setup_required).toBe(true);

    // Verify session cookie is issued
    const sessionCookie = extractCookie(loginRes, 'session');
    expect(sessionCookie).toBeDefined();

    // Verify user session endpoint returns null (only pendingTotpSetup session exists)
    const sessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      sessionCookie,
    );
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user).toBeNull();
  });

  test('should issue pendingTotpUser session when TOTP verification is required', async () => {
    const email = generateUniqueEmail('totp-required-pending-user');
    const password = 'password123';

    // Create user with TOTP enabled
    const userId = await createUserInDb(app, email, password);
    await enableTotpForUser(app, userId);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().totp_verification_required).toBe(true);

    // Verify session cookie is issued
    const sessionCookie = extractCookie(loginRes, 'session');
    expect(sessionCookie).toBeDefined();

    // Verify user session endpoint returns null (only pendingTotpUser session exists)
    const sessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      sessionCookie,
    );
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user).toBeNull();
  });

  test('should allow config user to login without TOTP (exempt from required)', async () => {
    // Config users are exempt from TOTP required check
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    // Config user should get full session immediately
    expect(body.totp_setup_required).toBe(false);
    expect(body.totp_verification_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.managed_by).toBe('config');
  });
});

/**
 * =============================================================================
 * TOTP Optional Mode Tests
 * Config: totp.enabled = true, totp.required = false
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Optional Mode', () => {
  const app = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        password: {
          email_verification: false, // Disable email verification to isolate TOTP tests
          totp: {
            enabled: true,
            required: false,
          },
        },
      },
    },
  });

  test('should login immediately for user without TOTP registered', async () => {
    const email = generateUniqueEmail('totp-optional-no-totp');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();
    });

    // Login should succeed immediately
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.totp_setup_required).toBe(false);
    expect(body.totp_verification_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(email);
    expect(body.user.totp_enabled).toBe(false);
  });

  test('should require TOTP verification for user with TOTP registered', async () => {
    const email = generateUniqueEmail('totp-optional-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(app, email, password);
    await enableTotpForUser(app, userId);

    // Login should require TOTP verification
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.totp_verification_required).toBe(true);
    expect(body.totp_setup_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).not.toHaveProperty('user');
  });

  test('should issue real user session for non-TOTP user', async () => {
    const email = generateUniqueEmail('totp-optional-real-session');
    const password = 'password123';

    // Create user without TOTP
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

    // Verify user session endpoint returns actual user data
    const sessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      sessionCookie,
    );
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user).not.toBeNull();
    expect(sessionRes.json().user.email).toBe(email);
  });
});

/**
 * =============================================================================
 * TOTP Disabled Mode Tests
 * Config: totp.enabled = false
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Disabled Mode', () => {
  const app = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        password: {
          email_verification: false, // Disable email verification to isolate TOTP tests
          totp: {
            enabled: false,
            required: false,
          },
        },
      },
    },
  });

  test('should login immediately for user without TOTP', async () => {
    const email = generateUniqueEmail('totp-disabled-no-totp');
    const password = 'password123';

    // Create user without TOTP
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
    const body = loginRes.json();
    expect(body.totp_setup_required).toBe(false);
    expect(body.totp_verification_required).toBe(false);
    expect(body.email_verification_required).toBe(false);
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(email);
  });

  test('should still require TOTP verification if user has TOTP registered (TOTP enabled in user takes precedence)', async () => {
    const email = generateUniqueEmail('totp-disabled-with-totp');
    const password = 'password123';

    // Create user in DB
    const userId = await createUserInDb(app, email, password);

    // Enable TOTP for user (even though TOTP is disabled in config)
    await enableTotpForUser(app, userId);

    // Login should still require TOTP verification because user has TOTP enabled
    // Note: The login logic checks user.totp_enabled regardless of config.totp.enabled
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.totp_setup_required).toBe(false);
    // User has TOTP registered, so verification is required
    expect(body.totp_verification_required).toBe(true);
    expect(body.email_verification_required).toBe(false);
    expect(body).not.toHaveProperty('user');
  });
});

/**
 * =============================================================================
 * Email Verification + TOTP Combination Tests
 * Config: email_verification = true, totp.enabled = true, totp.required = true
 * =============================================================================
 */
describe('POST /api/v1/auth/login - Email Verification + TOTP', () => {
  const app = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        password: {
          email_verification: true,
          totp: {
            enabled: true,
            required: true,
          },
        },
      },
    },
  });

  test('should require email verification first for unverified user (before TOTP)', async () => {
    const email = generateUniqueEmail('email-totp-unverified');
    const password = 'password123';

    // Create user with unverified email and no TOTP
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false; // Email not verified
      await app.mikro.em.persist(user).flush();
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    // Email verification should be required first
    expect(body.email_verification_required).toBe(true);
    expect(body.totp_setup_required).toBe(false);
    expect(body.totp_verification_required).toBe(false);
    expect(body.email).toBe(email);
    expect(body).not.toHaveProperty('user');
  });

  test('should require TOTP setup after email is verified (no TOTP registered)', async () => {
    const email = generateUniqueEmail('email-totp-verified-no-totp');
    const password = 'password123';

    // Create user with verified email but no TOTP
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true; // Email verified
      await app.mikro.em.persist(user).flush();
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    // TOTP setup should be required (email is already verified)
    expect(body.email_verification_required).toBe(false);
    expect(body.totp_setup_required).toBe(true);
    expect(body.totp_verification_required).toBe(false);
    expect(body).not.toHaveProperty('user');
  });

  test('should require TOTP verification after email is verified (TOTP registered)', async () => {
    const email = generateUniqueEmail('email-totp-verified-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(app, email, password);

    // Enable TOTP for user
    await enableTotpForUser(app, userId);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    // TOTP verification should be required
    expect(body.email_verification_required).toBe(false);
    expect(body.totp_setup_required).toBe(false);
    expect(body.totp_verification_required).toBe(true);
    expect(body).not.toHaveProperty('user');
  });
});

/**
 * =============================================================================
 * Session State Verification Tests
 * =============================================================================
 */
describe('POST /api/v1/auth/login - Session State Verification', () => {
  const app = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        password: {
          email_verification: false,
          totp: {
            enabled: true,
            required: true,
          },
        },
      },
    },
  });

  test('should not allow protected API access with pendingTotpSetup session', async () => {
    const email = generateUniqueEmail('session-pending-setup');
    const password = 'password123';

    // Create user without TOTP
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
    expect(loginRes.json().totp_setup_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access protected password change endpoint
    const changePasswordRes = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
          new_password: 'newpassword123',
        },
      },
      sessionCookie,
    );

    // Should be unauthorized since only pendingTotpSetup session exists
    expect(changePasswordRes.statusCode).toBe(401);
  });

  test('should not allow protected API access with pendingTotpUser session', async () => {
    const email = generateUniqueEmail('session-pending-user');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(app, email, password);
    await enableTotpForUser(app, userId);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().totp_verification_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access protected password change endpoint
    const changePasswordRes = await injectWithSession(
      app,
      {
        method: 'PUT',
        url: '/api/v1/user/password',
        payload: {
          current_password: password,
          new_password: 'newpassword123',
        },
      },
      sessionCookie,
    );

    // Should be unauthorized since only pendingTotpUser session exists
    expect(changePasswordRes.statusCode).toBe(401);
  });

  test('should allow protected API access with full user session', async () => {
    // Use config user which is exempt from TOTP required
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json()).toHaveProperty('user');

    const sessionCookie = extractCookie(loginRes, 'session');

    // Access user session endpoint should work
    const sessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      sessionCookie,
    );

    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json().user).not.toBeNull();
    expect(sessionRes.json().user.email).toBe(TEST_USER.email);
  });

  test('should complete login flow: TOTP setup -> verify -> full session', async () => {
    const email = generateUniqueEmail('session-complete-flow');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();
    });

    // Step 1: Login - should require TOTP setup
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().totp_setup_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Step 2: Setup TOTP
    const setupRes = await injectWithSession(
      app,
      { method: 'POST', url: '/api/v1/user/totp/setup' },
      sessionCookie,
    );

    expect(setupRes.statusCode).toBe(200);
    const secret = setupRes.json().secret;

    // Step 3: Verify TOTP code
    const validCode = app.totpService.generateToken(secret);
    const verifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: { code: validCode },
      },
      sessionCookie,
    );

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().success).toBe(true);
    expect(verifyRes.json().totp_setup_completed).toBe(true);
    expect(verifyRes.json()).toHaveProperty('user');

    // Get the updated session cookie from verify response
    const updatedSessionCookie = extractCookie(verifyRes, 'session');

    // Step 4: Now should be able to access protected endpoints
    const finalSessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      updatedSessionCookie,
    );

    expect(finalSessionRes.statusCode).toBe(200);
    expect(finalSessionRes.json().user).not.toBeNull();
    expect(finalSessionRes.json().user.email).toBe(email);
    expect(finalSessionRes.json().user.totp_enabled).toBe(true);
  });

  test('should complete login flow: TOTP verification -> full session', async () => {
    const email = generateUniqueEmail('session-verify-flow');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(app, email, password);
    const secret = await enableTotpForUser(app, userId);

    // Step 1: Login - should require TOTP verification
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().totp_verification_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Step 2: Verify TOTP code
    const validCode = app.totpService.generateToken(secret);
    const verifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/verify',
        payload: { code: validCode },
      },
      sessionCookie,
    );

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json()).toHaveProperty('user');
    expect(verifyRes.json().user.email).toBe(email);

    // Get the updated session cookie from verify response
    const updatedSessionCookie = extractCookie(verifyRes, 'session');

    // Step 3: Now should be able to access protected endpoints
    const finalSessionRes = await injectWithSession(
      app,
      { method: 'GET', url: '/api/v1/user/session' },
      updatedSessionCookie,
    );

    expect(finalSessionRes.statusCode).toBe(200);
    expect(finalSessionRes.json().user).not.toBeNull();
    expect(finalSessionRes.json().user.email).toBe(email);
    expect(finalSessionRes.json().user.totp_enabled).toBe(true);
  });
});
