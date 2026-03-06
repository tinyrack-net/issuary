import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entries/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
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

/**
 * Helper to start TOTP setup and return secret
 */
async function startTotpSetup(sessionCookie: string): Promise<string> {
  const client = testClient(app);
  const res = await client.api.user.totp.setup.$post(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );

  const body = await assertJsonBody(res);
  return body.secret;
}

describe('POST /api/user/totp/verify', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post({
      json: { code: '123456' },
    });

    await expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP setup was not started', async () => {
    const email = generateUniqueEmail('totp-verify-no-setup');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: '123456' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.TotpNotSetup);
  });

  test('should return 400 when code is invalid', async () => {
    const email = generateUniqueEmail('totp-verify-invalid-code');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start setup and get the secret
    const secret = await startTotpSetup(sessionCookie);

    // Generate a code from a DIFFERENT secret to ensure it's always invalid
    const differentSecret = services.totpService.generateSecret();
    const invalidCode = services.totpService.generateToken(differentSecret);

    // Ensure we don't accidentally use the same code
    const validCode = services.totpService.generateToken(secret);
    const codeToUse = invalidCode === validCode ? '999999' : invalidCode;

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: codeToUse } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.InvalidTotpCode);
  });

  test('should successfully verify TOTP and return recovery codes', async () => {
    const email = generateUniqueEmail('totp-verify-success');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start setup
    const secret = await startTotpSetup(sessionCookie);

    // Generate valid code
    const validCode = services.totpService.generateToken(secret);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);
    // Should return recovery codes, not user session
    expect(body).toHaveProperty('recovery_codes');
    expect(body).not.toHaveProperty('user');
    expect(Array.isArray(body.recovery_codes)).toBe(true);
    expect(body.recovery_codes.length).toBe(8);

    // Verify TOTP is verified but NOT fully registered in database
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserSub(userSub);
      expect(totp).not.toBeNull();
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(false);
    });
  });

  test('should return 409 when TOTP is fully registered', async () => {
    const email = generateUniqueEmail('totp-verify-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Enable TOTP fully in database (verified=true AND recovery_confirmed=true)
    const secret = services.totpService.generateSecret();
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await services.mikro.em.persist(totp).flush();
    });

    const validCode = services.totpService.generateToken(secret);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.TotpAlreadyEnabled);
  });

  test('should allow re-verification when TOTP is verified but not confirmed', async () => {
    const email = generateUniqueEmail('totp-verify-not-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create TOTP with verified=true but recovery_confirmed=false
    const secret = services.totpService.generateSecret();
    await withMikroContext(services, async () => {
      const totp = services.mikro.userTotp.create({
        user: userSub,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = false;
      await services.mikro.em.persist(totp).flush();
    });

    const validCode = services.totpService.generateToken(secret);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Should succeed and return recovery codes (allowing user to complete setup)
    const body = await assertJsonBody(res);
    expect(body.recovery_codes).toHaveLength(8);
  });

  test('should validate code format - non-numeric', async () => {
    const email = generateUniqueEmail('totp-verify-format-nonnumeric');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: 'abcdef' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should validate code format - wrong length', async () => {
    const email = generateUniqueEmail('totp-verify-format-length');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    const client = testClient(app);

    // Too short
    const res1 = await client.api.user.totp.verify.$post(
      { json: { code: '12345' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res1.status).toBe(400);

    // Too long
    const res2 = await client.api.user.totp.verify.$post(
      { json: { code: '1234567' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res2.status).toBe(400);
  });

  test('should reject codes from different secret (simulating expired/old codes)', async () => {
    const email = generateUniqueEmail('totp-verify-timing');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start setup
    await startTotpSetup(sessionCookie);

    // Generate a code from a completely different secret
    // This deterministically tests that invalid codes are rejected
    const differentSecret = services.totpService.generateSecret();
    const invalidCode = services.totpService.generateToken(differentSecret);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      { json: { code: invalidCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.InvalidTotpCode);
  });

  test('should NOT update session after verify (requires confirm)', async () => {
    const email = generateUniqueEmail('totp-verify-session-update');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);

    // Check initial session - TOTP should be disabled
    const sessionBefore = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBeforeBody = await assertJsonBody(sessionBefore);
    expect(sessionBeforeBody.user).toBeDefined();
    expect(sessionBeforeBody.user?.totp_registered).toBe(false);

    // Start setup and verify
    const secret = await startTotpSetup(sessionCookie);
    const validCode = services.totpService.generateToken(secret);

    await client.api.user.totp.verify.$post(
      { json: { code: validCode } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Check session after verify - TOTP should still NOT be enabled
    // (requires confirm step)
    const sessionAfter = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionAfterBody = await assertJsonBody(sessionAfter);
    expect(sessionAfterBody.user).toBeDefined();
    expect(sessionAfterBody.user?.totp_registered).toBe(false);
  });

  test('should handle concurrent setup/verify attempts correctly', async () => {
    const email = generateUniqueEmail('totp-verify-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start first setup
    const secret1 = await startTotpSetup(sessionCookie);

    // Start second setup (should override)
    const secret2 = await startTotpSetup(sessionCookie);

    // Secrets should be different
    expect(secret1).not.toBe(secret2);

    // Generate code from second secret (the active one)
    const code2 = services.totpService.generateToken(secret2);

    // Verify with second secret - should succeed
    const client = testClient(app);
    const res2 = await client.api.user.totp.verify.$post(
      { json: { code: code2 } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res2.status).toBe(200);
  });

  test('should reject old secret code after setup override', async () => {
    const email = generateUniqueEmail('totp-verify-old-secret');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start first setup
    const secret1 = await startTotpSetup(sessionCookie);

    // Start second setup (should override) - use a known different secret
    // by generating multiple times until we get a different one
    let secret2 = await startTotpSetup(sessionCookie);
    let attempts = 0;
    while (secret2 === secret1 && attempts < 5) {
      secret2 = await startTotpSetup(sessionCookie);
      attempts++;
    }

    expect(secret1).not.toBe(secret2);

    // Generate code from first (old) secret
    const code1 = services.totpService.generateToken(secret1);
    // Generate code from second (current) secret
    const code2 = services.totpService.generateToken(secret2);

    const client = testClient(app);

    // Only test if codes are different (to avoid false positive)
    if (code1 !== code2) {
      // Try to verify with first secret's code - should fail
      const res1 = await client.api.user.totp.verify.$post(
        { json: { code: code1 } },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      await expectError(res1, e.InvalidTotpCode);
    }

    // Verify with second secret - should succeed
    const res2 = await client.api.user.totp.verify.$post(
      { json: { code: code2 } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(res2.status).toBe(200);
  });

  test('should return 400 when body is empty', async () => {
    const email = generateUniqueEmail('totp-verify-empty-body');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    const client = testClient(app);
    const res = await client.api.user.totp.verify.$post(
      {
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });
});
