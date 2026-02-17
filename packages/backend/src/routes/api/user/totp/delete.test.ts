import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  enableTotpForUser,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

describe('DELETE /api/user/totp', () => {
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
    const client = testClient(app);
    const res = await client.api.user.totp.$delete({
      json: { code: '123456' },
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: '123456' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: '000000' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: 'abcdef' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);

    // Too short
    const res1 = await client.api.user.totp.$delete(
      { json: { code: '12345' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res1.status).toBe(400);

    // Too long
    const res2 = await client.api.user.totp.$delete(
      { json: { code: '1234567' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);

    // Check initial session - TOTP should be enabled
    const sessionBefore = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBeforeBody = await assertJsonBody(sessionBefore);
    expect(sessionBeforeBody.user).toBeDefined();
    expect(sessionBeforeBody.user?.totp_registered).toBe(true);

    // Disable TOTP
    const validCode = services.totpService.generateToken(secret);
    await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Check session after - TOTP should be disabled
    const sessionAfter = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionAfterBody = await assertJsonBody(sessionAfter);
    expect(sessionAfterBody.user).toBeDefined();
    expect(sessionAfterBody.user?.totp_registered).toBe(false);
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);

    // First deletion should succeed
    const res1 = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res1.status).toBe(200);

    // Second deletion with same code should fail (TOTP no longer enabled)
    const res2 = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);

    // Disable TOTP
    const disableRes = await client.api.user.totp.$delete(
      { json: { code: validCode1 } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(disableRes.status).toBe(200);

    // Start new setup
    const setupRes = await client.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const setupBody = await assertJsonBody(setupRes);
    const newSecret = setupBody.secret;

    // Verify new setup
    const newCode = services.totpService.generateToken(newSecret);
    const verifyRes = await client.api.user.totp.verify.$post(
      { json: { code: newCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(verifyRes.status).toBe(200);

    // Confirm new setup
    const confirmRes = await client.api.user.totp.confirm.$post(
      { json: {} },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(app);
    const res = await client.api.user.totp.$delete(
      {
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/user/totp - second_factor.required: true', () => {
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
  ): Promise<{
    sessionCookie: string;
    userId: string;
    totpSecret: string;
  }> {
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
    const loginClient = testClient(appWith2FARequired);
    const loginRes = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);

    const pending2FACookie = extractSessionCookie(loginRes);

    // Verify TOTP to get full session
    const validCode = servicesWith2FA.totpService.generateToken(totpSecret);
    const pendingClient = testClient(appWith2FARequired);
    const verifyRes = await pendingClient.api.auth.totp.verify.$post(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${pending2FACookie}` } },
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

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
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

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
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
    const sessionClient = testClient(appWith2FARequired);
    const sessionRes = await sessionClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    const userId = sessionBody.user?.id;
    if (!userId) return;

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

    const client = testClient(appWith2FARequired);
    const res = await client.api.user.totp.$delete(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });
});
