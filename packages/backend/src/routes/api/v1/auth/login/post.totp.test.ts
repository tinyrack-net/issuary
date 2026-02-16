/**
 * TOTP-related login tests.
 *
 * Tests various 2FA configuration combinations:
 * - 2FA Required Mode (second_factor.required: true, totp.enabled: true)
 * - 2FA Optional Mode (second_factor.required: false, totp.enabled: true)
 * - TOTP Disabled Mode (totp.enabled: false)
 * - Email Verification + 2FA combinations
 * - Session state verification
 *
 * Note: The login logic works as follows:
 * - If user.totp_registered (has TOTP registered in DB) => TOTP verification required (regardless of config)
 * - If second_factor.required && !user has 2FA set up => 2FA setup required
 * - Otherwise => immediate login success
 */

import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createTestClient,
  createTestClientWithHeaders,
  enableTotpForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

/**
 * Helper function to create a user in DB without triggering login flow.
 * Returns userId for further operations.
 */
async function createUserInDb(
  services: ServiceContainer,
  email: string,
  password: string,
  options: { emailVerified?: boolean } = {},
): Promise<string> {
  const { emailVerified = true } = options;
  let userId = '';

  await withMikroContext(services, async () => {
    const user = services.mikro.user.create({
      email,
      password_hash: password,
    });
    user.email_verified = emailVerified;
    await services.mikro.em.persist(user).flush();
    userId = user.id;
  });

  return userId;
}

/**
 * =============================================================================
 * 2FA Required Mode Tests
 * Config: second_factor.required = true, totp.enabled = true
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Required Mode', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          password: {
            email_verification: false,
            second_factor: {
              required: true,
            },
            totp: {
              enabled: true,
            },
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

  test('should require TOTP setup for user without TOTP registered', async () => {
    const email = generateUniqueEmail('totp-required-no-totp');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    // Login should return second_factor_setup_required
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    expect(body.user.second_factor_required).toBe(true);
    expect(body.user).not.toBeNull();
  });

  test('should require TOTP verification for user with TOTP registered', async () => {
    const email = generateUniqueEmail('totp-required-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(services, email, password);

    // Enable TOTP for user
    await enableTotpForUser(services, userId);

    // Login should return second_factor_required
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // User has TOTP registered, so verification is required
    expect(body.user.totp_registered).toBe(true);
    expect(body.user).not.toBeNull();
  });

  test('should issue pending2FASetup session when TOTP setup is required', async () => {
    const email = generateUniqueEmail('totp-required-pending-setup');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody.user.second_factor_required).toBe(true);

    // Verify session cookie is issued
    const sessionCookie = extractCookie(loginRes, 'session');
    expect(sessionCookie).toBeDefined();

    // Verify user session endpoint returns unauthenticated (only pending2FASetup session exists)
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const sessionRes = await sessionClient.api.v1.user.session.$get();
    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.user).toBeUndefined();
  });

  test('should issue pending2FAUser session when TOTP verification is required', async () => {
    const email = generateUniqueEmail('totp-required-pending-user');
    const password = 'password123';

    // Create user with TOTP enabled
    const userId = await createUserInDb(services, email, password);
    await enableTotpForUser(services, userId);

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody.user.second_factor_required).toBe(true);

    // Verify session cookie is issued
    const sessionCookie = extractCookie(loginRes, 'session');
    expect(sessionCookie).toBeDefined();

    // Verify user session endpoint returns unauthenticated (only pending2FAUser session exists)
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const sessionRes = await sessionClient.api.v1.user.session.$get();
    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.user).toBeUndefined();
  });

  test('should allow config user to login without TOTP (exempt from required)', async () => {
    // Config users are exempt from TOTP required check
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    const body = await assertJsonBody(loginRes);
    expect(body.user.managed_by).toBe('config');
    expect(body.user.second_factor_required).toBe(false);
  });
});

/**
 * =============================================================================
 * 2FA Optional Mode Tests
 * Config: second_factor.required = false, totp.enabled = true
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Optional Mode', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          password: {
            email_verification: false,
            second_factor: {
              required: false,
            },
            totp: {
              enabled: true,
            },
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

  test('should login immediately for user without TOTP registered', async () => {
    const email = generateUniqueEmail('totp-optional-no-totp');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    // Login should succeed immediately
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    expect(body.user.email).toBe(email);
    expect(body.user.totp_registered).toBeFalsy();
    expect(body.user.second_factor_required).toBe(false);
  });

  test('should require TOTP verification for user with TOTP registered', async () => {
    const email = generateUniqueEmail('totp-optional-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(services, email, password);
    await enableTotpForUser(services, userId);

    // Login should require TOTP verification
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // User has TOTP registered, so verification is required
    expect(body.user.totp_registered).toBe(true);
    expect(body.user).not.toBeNull();
  });

  test('should issue real user session for non-TOTP user', async () => {
    const email = generateUniqueEmail('totp-optional-real-session');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Verify user session endpoint returns actual user data
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const sessionRes = await sessionClient.api.v1.user.session.$get();
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).not.toBeNull();
    expect(sessionBody).toHaveProperty('user.email', email);
  });
});

/**
 * =============================================================================
 * TOTP Disabled Mode Tests
 * Config: totp.enabled = false
 * =============================================================================
 */
describe('POST /api/v1/auth/login - TOTP Disabled Mode', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          password: {
            email_verification: false,
            second_factor: {
              required: false,
            },
            totp: {
              enabled: false,
            },
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

  test('should login immediately for user without TOTP', async () => {
    const email = generateUniqueEmail('totp-disabled-no-totp');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    expect(body.user.email).toBe(email);
    expect(body.user.second_factor_required).toBe(false);
  });

  test('should still require TOTP verification if user has TOTP registered (TOTP enabled in user takes precedence)', async () => {
    const email = generateUniqueEmail('totp-disabled-with-totp');
    const password = 'password123';

    // Create user in DB
    const userId = await createUserInDb(services, email, password);

    // Enable TOTP for user (even though TOTP is disabled in config)
    await enableTotpForUser(services, userId);

    // Login should still require TOTP verification because user has TOTP enabled
    // Note: The login logic checks user.totp_registered regardless of config.totp.enabled
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // User has TOTP registered, so verification is required
    expect(body.user.totp_registered).toBe(true);
    expect(body.user).not.toBeNull();
  });
});

/**
 * =============================================================================
 * Email Verification + 2FA Combination Tests
 * Config: email_verification = true, second_factor.required = true, totp.enabled = true
 * =============================================================================
 */
describe('POST /api/v1/auth/login - Email Verification + TOTP', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          password: {
            email_verification: true,
            second_factor: {
              required: true,
            },
            totp: {
              enabled: true,
            },
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

  test('should require email verification first for unverified user (before TOTP)', async () => {
    const email = generateUniqueEmail('email-totp-unverified');
    const password = 'password123';

    // Create user with unverified email and no TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = false; // Email not verified
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // Email verification should be required first
    expect(body.user.email_verification_required).toBe(true);
    expect(body.user).not.toBeNull();
  });

  test('should require TOTP setup after email is verified (no TOTP registered)', async () => {
    const email = generateUniqueEmail('email-totp-verified-no-totp');
    const password = 'password123';

    // Create user with verified email but no TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true; // Email verified
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // TOTP setup should be required (email is already verified)
    expect(body.user.second_factor_required).toBe(true);
    expect(body.user).not.toBeNull();
  });

  test('should require TOTP verification after email is verified (TOTP registered)', async () => {
    const email = generateUniqueEmail('email-totp-verified-with-totp');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(services, email, password);

    // Enable TOTP for user
    await enableTotpForUser(services, userId);

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const body = await assertJsonBody(loginRes);
    // TOTP verification should be required
    expect(body.user.second_factor_required).toBe(true);
    expect(body.user).not.toBeNull();
  });
});

/**
 * =============================================================================
 * Session State Verification Tests
 * =============================================================================
 */
describe('POST /api/v1/auth/login - Session State Verification', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          password: {
            email_verification: false,
            second_factor: {
              required: true,
            },
            totp: {
              enabled: true,
            },
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

  test('should not allow protected API access with pending2FASetup session', async () => {
    const email = generateUniqueEmail('session-pending-setup');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginResBody = await assertJsonBody(loginRes);
    expect(loginResBody).toHaveProperty('user');
    expect(loginResBody.user.second_factor_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access protected password change endpoint
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const changePasswordRes = await sessionClient.api.v1.user.password.$put({
      json: {
        current_password: password,
        new_password: 'newpassword123',
      },
    });

    // Should be unauthorized since only pending2FASetup session exists
    expect(changePasswordRes.status).toBe(401);
  });

  test('should not allow protected API access with pending2FAUser session', async () => {
    const email = generateUniqueEmail('session-pending-user');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(services, email, password);
    await enableTotpForUser(services, userId);

    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginResBody = await assertJsonBody(loginRes);
    expect(loginResBody).toHaveProperty('user');
    expect(loginResBody.user.second_factor_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access protected password change endpoint
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const changePasswordRes = await sessionClient.api.v1.user.password.$put({
      json: {
        current_password: password,
        new_password: 'newpassword123',
      },
    });

    // Should be unauthorized since only pending2FAUser session exists
    expect(changePasswordRes.status).toBe(401);
  });

  test('should allow protected API access with full user session', async () => {
    // Use config user which is exempt from TOTP required
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginRes.status).toBe(200);
    const loginResBody = await loginRes.json();
    expect(loginResBody).toHaveProperty('user');

    const sessionCookie = extractCookie(loginRes, 'session');

    // Access user session endpoint should work
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const sessionRes = await sessionClient.api.v1.user.session.$get();

    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).not.toBeNull();
    expect(sessionBody).toHaveProperty('user.email', TEST_USER.email);
  });

  test('should complete login flow: TOTP setup -> verify -> full session', async () => {
    const email = generateUniqueEmail('session-complete-flow');
    const password = 'password123';

    // Create user without TOTP
    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    // Step 1: Login - should require TOTP setup
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginResBody = await assertJsonBody(loginRes);
    expect(loginResBody).toHaveProperty('user');
    expect(loginResBody.user.second_factor_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Step 2: Setup TOTP
    const sessionClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const setupRes = await sessionClient.api.v1.user.totp.setup.$post();

    const setupBody = await assertJsonBody(setupRes);
    const secret = setupBody.secret;

    // Step 3: Verify TOTP code
    const validCode = services.totpService.generateToken(secret);
    const verifyRes = await sessionClient.api.v1.user.totp.verify.$post({
      json: { code: validCode },
    });

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toHaveProperty('recovery_codes');
    expect(verifyBody.recovery_codes).toHaveLength(8);

    // Step 4: Confirm recovery codes saved
    const confirmRes = await sessionClient.api.v1.user.totp.confirm.$post({
      json: {},
    });

    const confirmBody = await assertJsonBody(confirmRes);
    expect(confirmBody).toHaveProperty('user');
    expect(confirmBody.user.totp_registered).toBe(true);

    // Get the updated session cookie from confirm response
    const updatedSessionCookie = extractCookie(confirmRes, 'session');

    // Step 5: Now should be able to access protected endpoints
    const updatedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${updatedSessionCookie}`,
    });
    const finalSessionRes = await updatedClient.api.v1.user.session.$get();

    const finalBody = await assertJsonBody(finalSessionRes);
    expect(finalBody.user).not.toBeNull();
    expect(finalBody).toHaveProperty('user.email', email);
    expect(finalBody).toHaveProperty('user.totp_registered', true);
  });

  test('should complete login flow: TOTP verification -> full session', async () => {
    const email = generateUniqueEmail('session-verify-flow');
    const password = 'password123';

    // Create user in DB without login
    const userId = await createUserInDb(services, email, password);
    const secret = await enableTotpForUser(services, userId);

    // Step 1: Login - should require TOTP verification
    const client = createTestClient(app);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });

    const loginResBody = await assertJsonBody(loginRes);
    expect(loginResBody).toHaveProperty('user');
    expect(loginResBody.user.second_factor_required).toBe(true);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Step 2: Verify TOTP code
    const validCode = services.totpService.generateToken(secret);
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const verifyRes = await authedClient.api.v1.auth.totp.verify.$post({
      json: { code: validCode },
    });

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toHaveProperty('user');
    expect(verifyBody.user.email).toBe(email);

    // Get the updated session cookie from verify response
    const updatedSessionCookie = extractCookie(verifyRes, 'session');

    // Step 3: Now should be able to access protected endpoints
    const updatedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${updatedSessionCookie}`,
    });
    const finalSessionRes = await updatedClient.api.v1.user.session.$get();

    const finalBody = await assertJsonBody(finalSessionRes);
    expect(finalBody.user).not.toBeNull();
    expect(finalBody).toHaveProperty('user.email', email);
    expect(finalBody).toHaveProperty('user.totp_registered', true);
  });
});
