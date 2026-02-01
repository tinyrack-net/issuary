import { describe, expect, test } from 'vitest';
import { deepMerge } from '@/lib/config/index.js';
import { e } from '@/schemas/error.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  DEFAULT_TEST_CONFIG,
  expectError,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer({
  config: deepMerge(DEFAULT_TEST_CONFIG, {
    basic_authentication_methods: {
      password: {
        totp: {
          enabled: true,
        },
      },
    },
  }),
});

describe('POST /api/v1/user/totp/setup', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/totp/setup',
    });

    expectError(res, e.Unauthorized);
  });

  test('should return secret, otpauth_url, and qr_code on successful setup', async () => {
    const email = generateUniqueEmail('totp-setup-success');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
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

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

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

  test('should return 409 when TOTP is fully registered', async () => {
    const email = generateUniqueEmail('totp-setup-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP fully in database (verified AND recovery_confirmed)
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret: app.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
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

    expectError(res, e.TotpAlreadyEnabled);
  });

  test('should allow re-setup when TOTP is verified but not confirmed', async () => {
    const email = generateUniqueEmail('totp-setup-not-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Create TOTP with verified=true but recovery_confirmed=false
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret: app.totpService.generateSecret(),
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
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

    // Should succeed and allow user to start fresh setup
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.secret).toBeDefined();
    expect(body.otpauth_url).toBeDefined();
    expect(body.qr_code).toBeDefined();
  });

  test('should return 403 for config users', async () => {
    // Config users cannot setup 2FA
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );

    // Config users cannot setup 2FA
    expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should generate valid OTP auth URL that works with authenticator', async () => {
    const email = generateUniqueEmail('totp-setup-valid-otp');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
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

    // Generate a valid token using the secret via totpService
    const validToken = app.totpService.generateToken(body.secret);
    expect(validToken).toMatch(/^\d{6}$/);

    // Verify the token is valid using totpService
    const isValid = app.totpService.verifyToken(validToken, body.secret);
    expect(isValid).toBe(true);
  });
});
