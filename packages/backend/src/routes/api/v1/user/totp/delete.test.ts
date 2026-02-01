import { describe, expect, test } from 'vitest';
import { deepMerge } from '@/lib/config/index.js';
import { e } from '@/schemas/error.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  DEFAULT_TEST_CONFIG,
  enableTotpForUser,
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

describe('DELETE /api/v1/user/totp', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/user/totp',
      payload: {
        code: '123456',
      },
    });

    expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP is not enabled', async () => {
    const email = generateUniqueEmail('totp-delete-not-enabled');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '123456',
        },
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotEnabled);
  });

  test('should return 400 when code is invalid', async () => {
    const email = generateUniqueEmail('totp-delete-invalid-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP
    await enableTotpForUser(app, userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '000000',
        },
      },
      sessionCookie,
    );

    expectError(res, e.InvalidTotpCode);
  });

  test('should successfully disable TOTP with valid code', async () => {
    const email = generateUniqueEmail('totp-delete-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(app, userId);

    // Generate valid code
    const validCode = app.totpService.generateToken(secret);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);

    // Verify TOTP is removed from database
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp).toBeNull();
    });
  });

  test('should validate code format - non-numeric', async () => {
    const email = generateUniqueEmail('totp-delete-format-nonnumeric');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    await enableTotpForUser(app, userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: 'abcdef',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should validate code format - wrong length', async () => {
    const email = generateUniqueEmail('totp-delete-format-length');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    await enableTotpForUser(app, userId);

    // Too short
    const res1 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '12345',
        },
      },
      sessionCookie,
    );
    expect(res1.statusCode).toBe(400);

    // Too long
    const res2 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: '1234567',
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(400);
  });

  test('should update session to reflect TOTP disabled status', async () => {
    const email = generateUniqueEmail('totp-delete-session-update');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(app, userId);

    // Check initial session - TOTP should be enabled
    const sessionBefore = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionBefore.json().user.totp_registered).toBe(true);

    // Disable TOTP
    const validCode = app.totpService.generateToken(secret);
    await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    // Check session after - TOTP should be disabled
    const sessionAfter = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionAfter.json().user.totp_registered).toBe(false);
  });

  test('should not disable TOTP with unverified setup', async () => {
    const email = generateUniqueEmail('totp-delete-unverified');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Create unverified TOTP record
    const secret = app.totpService.generateSecret();
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret,
      });
      totp.verified = false;
      totp.recovery_confirmed = false;
      await app.mikro.em.persist(totp).flush();
    });

    const validCode = app.totpService.generateToken(secret);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotEnabled);
  });

  test('should not disable TOTP with verified but unconfirmed setup', async () => {
    const email = generateUniqueEmail('totp-delete-unconfirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Create verified but unconfirmed TOTP record
    const secret = app.totpService.generateSecret();
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
      await app.mikro.em.persist(totp).flush();
    });

    const validCode = app.totpService.generateToken(secret);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotEnabled);
  });

  test('should prevent replay attacks with same code', async () => {
    const email = generateUniqueEmail('totp-delete-replay');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(app, userId);
    const validCode = app.totpService.generateToken(secret);

    // First deletion should succeed
    const res1 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );
    expect(res1.statusCode).toBe(200);

    // Second deletion with same code should fail (TOTP no longer enabled)
    const res2 = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );
    expectError(res2, e.TotpNotEnabled);
  });

  test('should allow re-enabling TOTP after disabling', async () => {
    const email = generateUniqueEmail('totp-delete-reenable');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP (fully)
    const secret1 = await enableTotpForUser(app, userId);
    const validCode1 = app.totpService.generateToken(secret1);

    // Disable TOTP
    const disableRes = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode1,
        },
      },
      sessionCookie,
    );
    expect(disableRes.statusCode).toBe(200);

    // Start new setup
    const setupRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );
    expect(setupRes.statusCode).toBe(200);
    const newSecret = setupRes.json().secret;

    // Verify new setup
    const newCode = app.totpService.generateToken(newSecret);
    const verifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: newCode,
        },
      },
      sessionCookie,
    );
    expect(verifyRes.statusCode).toBe(200);

    // Confirm new setup
    const confirmRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );
    expect(confirmRes.statusCode).toBe(200);

    // Verify TOTP is fully enabled again
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findFullyRegisteredByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.secret).toBe(newSecret);
    });
  });

  test('should require code in request body', async () => {
    const email = generateUniqueEmail('totp-delete-no-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    await enableTotpForUser(app, userId);

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {},
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/v1/user/totp - second_factor.required: true', () => {
  const appWith2FARequired = setupTestServer({
    config: deepMerge(DEFAULT_TEST_CONFIG, {
      basic_authentication_methods: {
        password: {
          second_factor: {
            required: true,
          },
          totp: {
            enabled: true,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    }),
  });

  /**
   * Create a user with TOTP already enabled, then login and verify TOTP
   * to get a full session (not pending2FASetup)
   */
  async function createUserWithTotpSession(
    emailPrefix: string,
    password: string,
  ): Promise<{ sessionCookie: string; userId: string; totpSecret: string }> {
    const email = generateUniqueEmail(emailPrefix);

    // Create user directly in DB
    let userId = '';
    await withMikroContext(appWith2FARequired, async () => {
      const user = appWith2FARequired.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await appWith2FARequired.mikro.em.persist(user).flush();
      userId = user.id;
    });

    // Enable TOTP for user
    const totpSecret = await enableTotpForUser(appWith2FARequired, userId);

    // Login - will require 2FA verification
    const loginRes = await appWith2FARequired.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes.statusCode).toBe(200);

    const pending2FACookie =
      loginRes.cookies.find((c) => c.name === 'session')?.value ?? '';

    // Verify TOTP to get full session
    const validCode = appWith2FARequired.totpService.generateToken(totpSecret);
    const verifyRes = await appWith2FARequired.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verify',
      cookies: { session: pending2FACookie },
      payload: { code: validCode },
    });
    expect(verifyRes.statusCode).toBe(200);

    const sessionCookie =
      verifyRes.cookies.find((c) => c.name === 'session')?.value ?? '';

    return { sessionCookie, userId, totpSecret };
  }

  test('should prevent disabling TOTP when no passkey exists and 2FA is required', async () => {
    const password = 'testPassword123!';

    const { sessionCookie, userId, totpSecret } =
      await createUserWithTotpSession(
        'totp-delete-2fa-required-no-passkey',
        password,
      );

    // User has only TOTP as 2FA, try to disable it
    const validCode = appWith2FARequired.totpService.generateToken(totpSecret);

    const res = await injectWithSession(
      appWith2FARequired,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.CannotRemoveLastSecondFactor);

    // Verify TOTP was NOT deleted
    await withMikroContext(appWith2FARequired, async () => {
      const totp =
        await appWith2FARequired.mikro.userTotp.findFullyRegisteredByUserId(
          userId,
        );
      expect(totp).not.toBeNull();
    });
  });

  test('should allow disabling TOTP when passkey exists and 2FA is required', async () => {
    const password = 'testPassword123!';

    const { sessionCookie, userId, totpSecret } =
      await createUserWithTotpSession(
        'totp-delete-2fa-required-has-passkey',
        password,
      );

    // Also add a passkey
    await createPasskeyForUser(appWith2FARequired, userId, 'Test Passkey');

    const validCode = appWith2FARequired.totpService.generateToken(totpSecret);

    const res = await injectWithSession(
      appWith2FARequired,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Verify TOTP was deleted
    await withMikroContext(appWith2FARequired, async () => {
      const totp =
        await appWith2FARequired.mikro.userTotp.findFullyRegisteredByUserId(
          userId,
        );
      expect(totp).toBeNull();
    });
  });

  test('should prevent config user from disabling TOTP', async () => {
    // Create TOTP for config user first (bypassing normal flow)
    const sessionCookie = await createAuthenticatedSession(appWith2FARequired);

    // Get user ID from session
    const sessionRes = await injectWithSession(
      appWith2FARequired,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    const userId = sessionRes.json().user.id;

    // Create TOTP directly in database for config user
    const secret = appWith2FARequired.totpService.generateSecret();
    await withMikroContext(appWith2FARequired, async () => {
      const user = await appWith2FARequired.mikro.user.findOneOrFail({
        id: userId,
      });
      const totp = appWith2FARequired.mikro.userTotp.create({
        user,
        secret,
        verified: true,
        recovery_confirmed: true,
      });
      await appWith2FARequired.mikro.em.persist(totp).flush();
    });

    const validCode = appWith2FARequired.totpService.generateToken(secret);

    const res = await injectWithSession(
      appWith2FARequired,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });
});
