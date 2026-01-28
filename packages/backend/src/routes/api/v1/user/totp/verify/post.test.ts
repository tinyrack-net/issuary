import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer({
  configOverrides: {
    basic_authentication_methods: {
      password: {
        totp: {
          enabled: true,
        },
      },
    },
  },
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

  test('should successfully verify and enable TOTP with valid code', async () => {
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
    expect(body).toHaveProperty('user');
    expect(body.user.totp_registered).toBe(true);

    // Verify TOTP is now enabled in database
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.verified).toBe(true);
    });
  });

  test('should return 409 when TOTP is already enabled', async () => {
    const email = generateUniqueEmail('totp-verify-already-enabled');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Enable TOTP directly in database
    const secret = app.totpService.generateSecret();
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const totp = app.mikro.userTotp.create({
        user,
        secret,
      });
      totp.verified = true;
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

  test('should update session to reflect TOTP enabled status', async () => {
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

    // Check session after - TOTP should be enabled
    const sessionAfter = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionAfter.json().user.totp_registered).toBe(true);
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
