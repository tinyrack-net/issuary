import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  injectWithSession,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
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
});

afterAll(async () => {
  await app.close();
});

/**
 * Helper to start TOTP setup and return secret
 */
async function startTotpSetup(sessionCookie: string): Promise<string> {
  const res = await injectWithSession(
    app,
    {
      method: 'POST',
      url: '/api/v1/user/totp/setup',
    },
    sessionCookie,
  );

  expect(res.statusCode).toBe(200);
  return res.json().secret;
}

describe('POST /api/v1/user/totp/verify', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/totp/verify',
      payload: {
        code: '123456',
      },
    });

    expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP setup was not started', async () => {
    const email = generateUniqueEmail('totp-verify-no-setup');
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
        url: '/api/v1/user/totp/verify',
        payload: {
          code: '123456',
        },
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotSetup);
  });

  test('should return 400 when code is invalid', async () => {
    const email = generateUniqueEmail('totp-verify-invalid-code');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Start setup and get the secret
    const secret = await startTotpSetup(sessionCookie);

    // Generate a code from a DIFFERENT secret to ensure it's always invalid
    const differentSecret = app.totpService.generateSecret();
    const invalidCode = app.totpService.generateToken(differentSecret);

    // Ensure we don't accidentally use the same code
    const validCode = app.totpService.generateToken(secret);
    const codeToUse = invalidCode === validCode ? '999999' : invalidCode;

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: codeToUse,
        },
      },
      sessionCookie,
    );

    expectError(res, e.InvalidTotpCode);
  });

  test('should successfully verify TOTP and return recovery codes', async () => {
    const email = generateUniqueEmail('totp-verify-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Start setup
    const secret = await startTotpSetup(sessionCookie);

    // Generate valid code
    const validCode = app.totpService.generateToken(secret);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should return recovery codes, not user session
    expect(body).toHaveProperty('recovery_codes');
    expect(body).not.toHaveProperty('user');
    expect(Array.isArray(body.recovery_codes)).toBe(true);
    expect(body.recovery_codes.length).toBe(8);

    // Verify TOTP is verified but NOT fully registered in database
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(false);
    });
  });

  test('should return 409 when TOTP is fully registered', async () => {
    const email = generateUniqueEmail('totp-verify-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP fully in database (verified=true AND recovery_confirmed=true)
    const secret = app.totpService.generateSecret();
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret,
      });
      totp.verified = true;
      totp.recovery_confirmed = true;
      await app.mikro.em.persist(totp).flush();
    });

    const validCode = app.totpService.generateToken(secret);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.TotpAlreadyEnabled);
  });

  test('should allow re-verification when TOTP is verified but not confirmed', async () => {
    const email = generateUniqueEmail('totp-verify-not-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Create TOTP with verified=true but recovery_confirmed=false
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
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    // Should succeed and return recovery codes (allowing user to complete setup)
    expect(res.statusCode).toBe(200);
    expect(res.json().recovery_codes).toHaveLength(8);
  });

  test('should validate code format - non-numeric', async () => {
    const email = generateUniqueEmail('totp-verify-format-nonnumeric');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: 'abcdef',
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should validate code format - wrong length', async () => {
    const email = generateUniqueEmail('totp-verify-format-length');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    // Too short
    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
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
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: '1234567',
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(400);
  });

  test('should reject codes from different secret (simulating expired/old codes)', async () => {
    const email = generateUniqueEmail('totp-verify-timing');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Start setup
    await startTotpSetup(sessionCookie);

    // Generate a code from a completely different secret
    // This deterministically tests that invalid codes are rejected
    const differentSecret = app.totpService.generateSecret();
    const invalidCode = app.totpService.generateToken(differentSecret);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: invalidCode,
        },
      },
      sessionCookie,
    );

    expectError(res, e.InvalidTotpCode);
  });

  test('should NOT update session after verify (requires confirm)', async () => {
    const email = generateUniqueEmail('totp-verify-session-update');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Check initial session - TOTP should be disabled
    const sessionBefore = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionBefore.json().user.totp_registered).toBe(false);

    // Start setup and verify
    const secret = await startTotpSetup(sessionCookie);
    const validCode = app.totpService.generateToken(secret);

    await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: validCode,
        },
      },
      sessionCookie,
    );

    // Check session after verify - TOTP should still NOT be enabled
    // (requires confirm step)
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

  test('should handle concurrent setup/verify attempts correctly', async () => {
    const email = generateUniqueEmail('totp-verify-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
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
    const code2 = app.totpService.generateToken(secret2);

    // Verify with second secret - should succeed
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: code2,
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(200);
  });

  test('should reject old secret code after setup override', async () => {
    const email = generateUniqueEmail('totp-verify-old-secret');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
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
    const code1 = app.totpService.generateToken(secret1);
    // Generate code from second (current) secret
    const code2 = app.totpService.generateToken(secret2);

    // Only test if codes are different (to avoid false positive)
    if (code1 !== code2) {
      // Try to verify with first secret's code - should fail
      const res1 = await injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/user/totp/verify',
          payload: {
            code: code1,
          },
        },
        sessionCookie,
      );
      expectError(res1, e.InvalidTotpCode);
    }

    // Verify with second secret - should succeed
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {
          code: code2,
        },
      },
      sessionCookie,
    );
    expect(res2.statusCode).toBe(200);
  });

  test('should return 400 when body is empty', async () => {
    const email = generateUniqueEmail('totp-verify-empty-body');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );
    await startTotpSetup(sessionCookie);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: {},
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });
});
