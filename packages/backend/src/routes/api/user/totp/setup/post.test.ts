import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

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
        password: {
          ...MINIMAL_TEST_CONFIG.auth.password,
          totp: { ...MINIMAL_TEST_CONFIG.auth.password.totp, enabled: true },
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

describe('POST /api/user/totp/setup', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post();

    await expectError(res, e.Unauthorized);
  });

  test('should return secret, otpauth_url, and qr_code on successful setup', async () => {
    const email = generateUniqueEmail('totp-setup-success');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

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

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // Verify database record
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserSub(userSub);
      expect(totp).not.toBeNull();
      expect(totp?.secret).toBe(body.secret);
      expect(totp?.verified).toBe(false);
    });
  });

  test('should regenerate secret on repeated setup calls', async () => {
    const email = generateUniqueEmail('totp-setup-regenerate');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);

    // First setup call
    const res1 = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const firstBody = await assertJsonBody(res1);
    const firstSecret = firstBody.secret;

    // Second setup call should regenerate secret
    const res2 = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const secondBody = await assertJsonBody(res2);
    const secondSecret = secondBody.secret;

    // Secrets should be different
    expect(secondSecret).not.toBe(firstSecret);
  });

  test('should return 409 when TOTP is fully registered', async () => {
    const email = generateUniqueEmail('totp-setup-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP fully in database (verified AND recovery_confirmed)
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret: services.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();
    });

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.TotpAlreadyEnabled);
  });

  test('should allow re-setup when TOTP is verified but not confirmed', async () => {
    const email = generateUniqueEmail('totp-setup-not-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create TOTP with verified=true but recovery_confirmed=false
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret: services.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
      await services.mikro.em.persist(totp).flush();
    });

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Should succeed and allow user to start fresh setup
    const body = await assertJsonBody(res);
    expect(body.secret).toBeDefined();
    expect(body.otpauth_url).toBeDefined();
    expect(body.qr_code).toBeDefined();
  });

  test('should return 403 for config users', async () => {
    // Config users cannot setup 2FA
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Config users cannot setup 2FA
    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should generate valid OTP auth URL that works with authenticator', async () => {
    const email = generateUniqueEmail('totp-setup-valid-otp');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // Generate a valid token using the secret via totpService
    const validToken = services.totpService.generateToken(body.secret);
    expect(validToken).toMatch(/^\d{6}$/);

    // Verify the token is valid using totpService
    const isValid = services.totpService.verifyToken(validToken, body.secret);
    expect(isValid).toBe(true);
  });
});

describe('POST /api/user/totp/setup - TOTP disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          password: {
            ...MINIMAL_TEST_CONFIG.auth.password,
            totp: { ...MINIMAL_TEST_CONFIG.auth.password.totp, enabled: false },
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

  test('should return validation error when TOTP is disabled', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const client = testClient(appDisabled);
    const res = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('TOTP is disabled');
  });
});
