import type { AppType } from '@backend/lib/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  enableTotpForUser,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('DELETE /api/v1/user/totp', () => {
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

  test('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/v1/user/totp', {
      method: 'DELETE',
      body: JSON.stringify({
        code: '123456',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP is not enabled', async () => {
    const email = generateUniqueEmail('totp-delete-not-enabled');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: '123456',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.TotpNotEnabled);
  });

  test('should return 400 when code is invalid', async () => {
    const email = generateUniqueEmail('totp-delete-invalid-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP
    await enableTotpForUser(services, userId);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: '000000',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.InvalidTotpCode);
  });

  test('should successfully disable TOTP with valid code', async () => {
    const email = generateUniqueEmail('totp-delete-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(services, userId);

    // Generate valid code
    const validCode = services.totpService.generateToken(secret);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify TOTP is removed from database
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp).toBeNull();
    });
  });

  test('should validate code format - non-numeric', async () => {
    const email = generateUniqueEmail('totp-delete-format-nonnumeric');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await enableTotpForUser(services, userId);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: 'abcdef',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });

  test('should validate code format - wrong length', async () => {
    const email = generateUniqueEmail('totp-delete-format-length');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await enableTotpForUser(services, userId);

    // Too short
    const res1 = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: '12345',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(res1.status).toBe(400);

    // Too long
    const res2 = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: '1234567',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(res2.status).toBe(400);
  });

  test('should update session to reflect TOTP disabled status', async () => {
    const email = generateUniqueEmail('totp-delete-session-update');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(services, userId);

    // Check initial session - TOTP should be enabled
    const sessionBefore = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionBeforeBody = await sessionBefore.json();
    expect(sessionBeforeBody.user.totp_registered).toBe(true);

    // Disable TOTP
    const validCode = services.totpService.generateToken(secret);
    await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    // Check session after - TOTP should be disabled
    const sessionAfter = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionAfterBody = await sessionAfter.json();
    expect(sessionAfterBody.user.totp_registered).toBe(false);
  });

  test('should not disable TOTP with unverified setup', async () => {
    const email = generateUniqueEmail('totp-delete-unverified');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create unverified TOTP record
    const secret = services.totpService.generateSecret();
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret,
      });
      totp.verified = false;
      totp.recovery_confirmed = false;
      await services.mikro.em.persist(totp).flush();
    });

    const validCode = services.totpService.generateToken(secret);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.TotpNotEnabled);
  });

  test('should not disable TOTP with verified but unconfirmed setup', async () => {
    const email = generateUniqueEmail('totp-delete-unconfirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create verified but unconfirmed TOTP record
    const secret = services.totpService.generateSecret();
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userId,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
      await services.mikro.em.persist(totp).flush();
    });

    const validCode = services.totpService.generateToken(secret);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.TotpNotEnabled);
  });

  test('should prevent replay attacks with same code', async () => {
    const email = generateUniqueEmail('totp-delete-replay');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP
    const secret = await enableTotpForUser(services, userId);
    const validCode = services.totpService.generateToken(secret);

    // First deletion should succeed
    const res1 = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(res1.status).toBe(200);

    // Second deletion with same code should fail (TOTP no longer enabled)
    const res2 = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    await expectError(res2, e.TotpNotEnabled);
  });

  test('should allow re-enabling TOTP after disabling', async () => {
    const email = generateUniqueEmail('totp-delete-reenable');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP (fully)
    const secret1 = await enableTotpForUser(services, userId);
    const validCode1 = services.totpService.generateToken(secret1);

    // Disable TOTP
    const disableRes = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode1,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(disableRes.status).toBe(200);

    // Start new setup
    const setupRes = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );
    expect(setupRes.status).toBe(200);
    const newSecret = (await setupRes.json()).secret;

    // Verify new setup
    const newCode = services.totpService.generateToken(newSecret);
    const verifyRes = await requestWithSession(
      app,
      '/api/v1/user/totp/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          code: newCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(verifyRes.status).toBe(200);

    // Confirm new setup
    const confirmRes = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(confirmRes.status).toBe(200);

    // Verify TOTP is fully enabled again
    await withMikroContext(services, async () => {
      const totp =
        await services.mikro.userTotp.findFullyRegisteredByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.secret).toBe(newSecret);
    });
  });

  test('should require code in request body', async () => {
    const email = generateUniqueEmail('totp-delete-no-code');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await enableTotpForUser(services, userId);

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/user/totp - second_factor.required: true', () => {
  let appWith2FARequired: AppType;
  let servicesWith2FA: ServiceContainer;
  let cleanupWith2FA: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
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
      },
    });
    appWith2FARequired = server.app;
    servicesWith2FA = server.services;
    cleanupWith2FA = server.cleanup;
  });

  afterAll(async () => {
    await cleanupWith2FA();
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
    await withMikroContext(servicesWith2FA, async () => {
      const user = servicesWith2FA.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await servicesWith2FA.mikro.em.persist(user).flush();
      userId = user.id;
    });

    // Enable TOTP for user
    const totpSecret = await enableTotpForUser(servicesWith2FA, userId);

    // Login - will require 2FA verification
    const loginRes = await appWith2FARequired.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status).toBe(200);

    const pending2FACookie = extractSessionCookie(loginRes);

    // Verify TOTP to get full session
    const validCode = servicesWith2FA.totpService.generateToken(totpSecret);
    const verifyRes = await appWith2FARequired.request(
      '/api/v1/auth/totp/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: validCode }),
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${pending2FACookie}`,
        },
      },
    );
    expect(verifyRes.status).toBe(200);

    const sessionCookie = extractSessionCookie(verifyRes);

    return { sessionCookie, userId, totpSecret };
  }

  /**
   * Extract session cookie from response
   */
  function extractSessionCookie(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    const match = setCookie.match(/session=([^;]+)/);
    return match?.[1] ?? '';
  }

  test('should prevent disabling TOTP when no passkey exists and 2FA is required', async () => {
    const password = 'testPassword123!';

    const { sessionCookie, userId, totpSecret } =
      await createUserWithTotpSession(
        'totp-delete-2fa-required-no-passkey',
        password,
      );

    // User has only TOTP as 2FA, try to disable it
    const validCode = servicesWith2FA.totpService.generateToken(totpSecret);

    const res = await requestWithSession(
      appWith2FARequired,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.CannotRemoveLastSecondFactor);

    // Verify TOTP was NOT deleted
    await withMikroContext(servicesWith2FA, async () => {
      const totp =
        await servicesWith2FA.mikro.userTotp.findFullyRegisteredByUserId(
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
    await createPasskeyForUser(servicesWith2FA, userId, 'Test Passkey');

    const validCode = servicesWith2FA.totpService.generateToken(totpSecret);

    const res = await requestWithSession(
      appWith2FARequired,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify TOTP was deleted
    await withMikroContext(servicesWith2FA, async () => {
      const totp =
        await servicesWith2FA.mikro.userTotp.findFullyRegisteredByUserId(
          userId,
        );
      expect(totp).toBeNull();
    });
  });

  test('should prevent config user from disabling TOTP', async () => {
    // Create TOTP for config user first (bypassing normal flow)
    const sessionCookie = await createAuthenticatedSession(appWith2FARequired);

    // Get user ID from session
    const sessionRes = await requestWithSession(
      appWith2FARequired,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionBody = await sessionRes.json();
    const userId = sessionBody.user.id;

    // Create TOTP directly in database for config user
    const secret = servicesWith2FA.totpService.generateSecret();
    await withMikroContext(servicesWith2FA, async () => {
      const totp = servicesWith2FA.mikro.userTotp.create({
        user: userId,
        secret,
        verified: true,
        recovery_confirmed: true,
      });
      await servicesWith2FA.mikro.em.persist(totp).flush();
    });

    const validCode = servicesWith2FA.totpService.generateToken(secret);

    const res = await requestWithSession(
      appWith2FARequired,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });
});
