import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';
import type { AppType, ServiceContainer } from '@/types.js';

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

describe('POST /api/v1/user/totp/setup', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/v1/user/totp/setup', {
      method: 'POST',
    });

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

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

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
      app,
      services,
      email,
      password,
    );

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify database record
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
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

    // First setup call
    const res1 = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    expect(res1.status).toBe(200);
    const firstSecret = (await res1.json()).secret;

    // Second setup call should regenerate secret
    const res2 = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    expect(res2.status).toBe(200);
    const secondSecret = (await res2.json()).secret;

    // Secrets should be different
    expect(secondSecret).not.toBe(firstSecret);
  });

  test('should return 409 when TOTP is fully registered', async () => {
    const email = generateUniqueEmail('totp-setup-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP fully in database (verified AND recovery_confirmed)
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret: services.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();
    });

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    await expectError(res, e.TotpAlreadyEnabled);
  });

  test('should allow re-setup when TOTP is verified but not confirmed', async () => {
    const email = generateUniqueEmail('totp-setup-not-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create TOTP with verified=true but recovery_confirmed=false
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret: services.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
      await services.mikro.em.persist(totp).flush();
    });

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    // Should succeed and allow user to start fresh setup
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secret).toBeDefined();
    expect(body.otpauth_url).toBeDefined();
    expect(body.qr_code).toBeDefined();
  });

  test('should return 403 for config users', async () => {
    // Config users cannot setup 2FA
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
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

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // Generate a valid token using the secret via totpService
    const validToken = services.totpService.generateToken(body.secret);
    expect(validToken).toMatch(/^\d{6}$/);

    // Verify the token is valid using totpService
    const isValid = services.totpService.verifyToken(validToken, body.secret);
    expect(isValid).toBe(true);
  });
});
