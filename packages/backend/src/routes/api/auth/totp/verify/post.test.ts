import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  enableTotpForUser,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
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
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('POST /api/auth/totp/verify', () => {
  test('should complete login with valid TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    const secret = await enableTotpForUser(services, userSub);

    // Login with password - should get 2fa_required status
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody).toHaveProperty('user');
    expect(loginBody.user.totp_registered).toBe(true);

    // Get session cookie from login response
    const sessionCookie = extractCookie(loginRes, 'session');

    // Generate valid TOTP code
    const validCode = services.totpService.generateToken(secret);

    // Verify TOTP code
    const authedClient = testClient(app);
    const verifyRes = await authedClient.api.auth.totp.verify.$post(
      {
        json: { code: validCode },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toHaveProperty('user');
    expect(verifyBody.user.sub).toBe(userSub);
    expect(verifyBody.user.email).toBe(email);
    expect(verifyBody.user.totp_registered).toBe(true);
  });

  test('should fail with invalid TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-invalid');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    await enableTotpForUser(services, userSub);

    // Login with password
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with invalid code
    const authedClient = testClient(app);
    const verifyRes = await authedClient.api.auth.totp.verify.$post(
      {
        json: { code: '000000' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(verifyRes, e.InvalidTotpCode);
  });

  test('should fail without pending TOTP session', async () => {
    // Try to verify TOTP without logging in first
    const client = testClient(app);
    const verifyRes = await client.api.auth.totp.verify.$post({
      json: { code: '123456' },
    });

    await expectError(verifyRes, e.Unauthorized);
  });

  test('should fail with malformed TOTP code', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-malformed');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    await enableTotpForUser(services, userSub);

    // Login with password
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with malformed code (not 6 digits)
    const authedClient = testClient(app);
    const verifyRes = await authedClient.api.auth.totp.verify.$post(
      {
        json: { code: '12345' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(verifyRes.status).toBe(400);
  });

  test('should not allow access to protected routes with pending TOTP session', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-pending-protected');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    await enableTotpForUser(services, userSub);

    // Login with password (creates pending TOTP session)
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to access a protected route (session endpoint) with pending TOTP
    const authedClient = testClient(app);
    const sessionRes = await authedClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Should return unauthenticated status since session is not complete
    expect(sessionRes.status).toBe(200);
    const body = await sessionRes.json();
    expect(body.user).toBeNull();
  });

  test('should allow access to protected routes after successful TOTP verification', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-protected-access');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    const secret = await enableTotpForUser(services, userSub);

    // Login with password (creates pending TOTP session)
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const pendingSessionCookie = extractCookie(loginRes, 'session');

    // Verify TOTP code
    const validCode = services.totpService.generateToken(secret);
    const pendingClient = testClient(app);
    const verifyRes = await pendingClient.api.auth.totp.verify.$post(
      {
        json: { code: validCode },
      },
      { headers: { Cookie: `session=${pendingSessionCookie}` } },
    );
    expect(verifyRes.status).toBe(200);

    // Get the new session cookie from verify response
    const authenticatedCookie = extractCookie(verifyRes, 'session');

    // Now access protected route (session endpoint) with authenticated session
    const authedClient = testClient(app);
    const sessionRes = await authedClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${authenticatedCookie}` } },
    );

    const body = await assertJsonBody(sessionRes);
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('user.sub', userSub);
    expect(body).toHaveProperty('user.email', email);
    expect(body).toHaveProperty('user.totp_registered', true);
  });

  test('should return 400 when body is empty', async () => {
    // Create a user with TOTP enabled (email verified)
    const email = generateUniqueEmail('totp-verify-empty-body');
    const password = 'password123';

    // Create user with verified email
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP for user
    await enableTotpForUser(services, userSub);

    // Login with password
    const client = testClient(app);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    // Try to verify with empty body
    const authedClient = testClient(app);
    const verifyRes = await authedClient.api.auth.totp.verify.$post(
      {
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(verifyRes.status).toBe(400);
  });
});

// Note: Login TOTP flow tests are in the dedicated login/post.totp.test.ts file

describe('POST /api/auth/totp/verify - TOTP disabled', () => {
  let appDisabled: AppType;
  let servicesDisabled: ServiceContainer;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          password: {
            totp: {
              enabled: false,
            },
          },
        },
      },
    });
    appDisabled = server.app;
    servicesDisabled = server.services;
    cleanupDisabled = server.cleanup;
  });

  afterAll(async () => {
    await cleanupDisabled();
  });

  test('should return validation error when TOTP auth is disabled', async () => {
    const email = generateUniqueEmail('totp-verify-disabled');
    const password = 'password123';

    const { userSub } = await createDbUserWithSession(
      appDisabled,
      servicesDisabled,
      email,
      password,
    );
    await enableTotpForUser(servicesDisabled, userSub);

    const client = testClient(appDisabled);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes, 'session');

    const verifyRes = await client.api.auth.totp.verify.$post(
      {
        json: { code: '123456' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(verifyRes, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('TOTP authentication is disabled');
  });
});
