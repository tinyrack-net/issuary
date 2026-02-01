import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createDbUserWithSession,
  expectError,
  extractCookie,
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
          second_factor: {
            required: false,
          },
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
 * Helper to create a user with TOTP enabled and generate recovery codes.
 * Returns the pending 2FA session cookie and recovery codes.
 */
async function createUserWithTotpAndRecoveryCodes(
  emailPrefix: string,
): Promise<{
  pending2FACookie: string;
  recoveryCodes: string[];
  userId: string;
  totpSecret: string;
  email: string;
  password: string;
}> {
  const email = `${emailPrefix}-${Date.now()}@example.com`;
  const password = 'testPassword123!';

  // Create user and get session
  const { sessionCookie, userId } = await createDbUserWithSession(
    app,
    email,
    password,
  );

  // Start TOTP setup
  const setupRes = await injectWithSession(
    app,
    {
      method: 'POST',
      url: '/api/v1/user/totp/setup',
    },
    sessionCookie,
  );
  expect(setupRes.statusCode).toBe(200);
  const totpSecret = setupRes.json().secret;

  // Verify TOTP setup (this generates recovery codes)
  const validCode = app.totpService.generateToken(totpSecret);
  const verifyRes = await injectWithSession(
    app,
    {
      method: 'POST',
      url: '/api/v1/user/totp/verify',
      payload: { code: validCode },
    },
    sessionCookie,
  );
  expect(verifyRes.statusCode).toBe(200);
  const recoveryCodes = verifyRes.json().recovery_codes;
  expect(recoveryCodes).toHaveLength(8);

  // Confirm TOTP setup (acknowledge recovery codes)
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

  // Now login again to get a pending 2FA session
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  expect(loginRes.statusCode).toBe(200);
  const pending2FACookie = extractCookie(loginRes, 'session');

  return {
    pending2FACookie,
    recoveryCodes,
    userId,
    totpSecret,
    email,
    password,
  };
}

describe('POST /api/v1/auth/totp/recovery/verify', () => {
  test('should successfully authenticate with a valid recovery code', async () => {
    const { pending2FACookie, recoveryCodes } =
      await createUserWithTotpAndRecoveryCodes('recovery-success');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: recoveryCodes[0] },
      },
      pending2FACookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email');
  });

  test(
    'should invalidate recovery code after single use',
    { timeout: 30000 },
    async () => {
      const { pending2FACookie, recoveryCodes, email, password } =
        await createUserWithTotpAndRecoveryCodes('recovery-single-use');

      const code = recoveryCodes[0] ?? '';

      // First use should succeed
      const res1 = await injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/auth/totp/recovery/verify',
          payload: { code },
        },
        pending2FACookie,
      );
      expect(res1.statusCode).toBe(200);

      // Login again to get a new pending 2FA session
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      expect(loginRes.statusCode).toBe(200);
      const newCookie = extractCookie(loginRes, 'session');

      // Second use of same code should fail
      const res2 = await injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/auth/totp/recovery/verify',
          payload: { code },
        },
        newCookie,
      );
      expectError(res2, e.InvalidRecoveryCode);
    },
  );

  test('should reject invalid recovery code', { timeout: 30000 }, async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-invalid');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: 'aaaa-zzzz' },
      },
      pending2FACookie,
    );

    expectError(res, e.InvalidRecoveryCode);
  });

  test('should return 401 when no pending 2FA session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/recovery/verify',
      payload: { code: 'abcd-ef12' },
    });

    expectError(res, e.SecondFactorSessionExpired);
  });

  test('should validate code format', async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-format');

    // Missing hyphen
    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: 'abcdefgh' },
      },
      pending2FACookie,
    );
    expect(res1.statusCode).toBe(400);

    // Too short
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: 'abc-def' },
      },
      pending2FACookie,
    );
    expect(res2.statusCode).toBe(400);

    // Uppercase (should not match pattern)
    const res3 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: 'ABCD-EF12' },
      },
      pending2FACookie,
    );
    expect(res3.statusCode).toBe(400);
  });

  test('should allow using different recovery codes', async () => {
    const { pending2FACookie, recoveryCodes, email, password } =
      await createUserWithTotpAndRecoveryCodes('recovery-multiple');

    // Use first code
    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: recoveryCodes[0] },
      },
      pending2FACookie,
    );
    expect(res1.statusCode).toBe(200);

    // Login again and use second code
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: recoveryCodes[1] },
      },
      newCookie,
    );
    expect(res2.statusCode).toBe(200);
  });

  test('should mark recovery code as used in database', async () => {
    const { pending2FACookie, recoveryCodes, userId } =
      await createUserWithTotpAndRecoveryCodes('recovery-db-mark');

    await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: recoveryCodes[0] },
      },
      pending2FACookie,
    );

    // Verify in database that one code is marked as used
    await withMikroContext(app, async () => {
      const unusedCodes =
        await app.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(unusedCodes).toHaveLength(7); // 8 - 1 = 7

      const allCodes = await app.mikro.userTotpRecoveryCode.find({
        user: { id: userId },
      });
      const usedCodes = allCodes.filter((c) => c.used);
      expect(usedCodes).toHaveLength(1);
      expect(usedCodes[0]?.used_at).not.toBeNull();
    });
  });

  test('should delete recovery codes when TOTP is disabled', async () => {
    const email = `recovery-disable-${Date.now()}@example.com`;
    const password = 'testPassword123!';

    // Create user with TOTP and recovery codes
    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Setup TOTP
    const setupRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );
    const totpSecret = setupRes.json().secret;

    // Verify setup
    const validCode = app.totpService.generateToken(totpSecret);
    const verifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/verify',
        payload: { code: validCode },
      },
      sessionCookie,
    );
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().recovery_codes).toHaveLength(8);

    // Confirm recovery codes saved
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

    // Verify recovery codes exist
    await withMikroContext(app, async () => {
      const codes =
        await app.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(codes).toHaveLength(8);
    });

    // Disable TOTP
    const disableCode = app.totpService.generateToken(totpSecret);
    const disableRes = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: { code: disableCode },
      },
      sessionCookie,
    );
    expect(disableRes.statusCode).toBe(200);

    // Verify recovery codes are deleted
    await withMikroContext(app, async () => {
      const codes =
        await app.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(codes).toHaveLength(0);
    });
  });

  test('should return NoRecoveryCodesAvailable when all codes are used', async () => {
    const { pending2FACookie, recoveryCodes, email, password, userId } =
      await createUserWithTotpAndRecoveryCodes('recovery-exhausted');

    // Use all 8 recovery codes
    for (let i = 0; i < 8; i++) {
      // Login to get pending 2FA session
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      const cookie = extractCookie(loginRes, 'session');

      const res = await injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/auth/totp/recovery/verify',
          payload: { code: recoveryCodes[i] },
        },
        i === 0 ? pending2FACookie : cookie,
      );
      expect(res.statusCode).toBe(200);
    }

    // Verify all codes are used in database
    await withMikroContext(app, async () => {
      const unusedCodes =
        await app.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(unusedCodes).toHaveLength(0);
    });

    // Login again and try to use a recovery code
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: { code: 'abcd-1234' },
      },
      newCookie,
    );
    expectError(res, e.NoRecoveryCodesAvailable);
  });

  test('should fail recovery code login after TOTP is disabled', async () => {
    const { email, password, totpSecret } =
      await createUserWithTotpAndRecoveryCodes('recovery-after-disable');

    // Get authenticated session (not pending 2FA)
    const loginRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const pending2FACookie = extractCookie(loginRes1, 'session');

    // Use TOTP to complete login
    const totpCode = app.totpService.generateToken(totpSecret);
    const totpVerifyRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/verify',
        payload: { code: totpCode },
      },
      pending2FACookie,
    );
    expect(totpVerifyRes.statusCode).toBe(200);
    const authedCookie = extractCookie(totpVerifyRes, 'session');

    // Disable TOTP with authenticated session
    const disableCode = app.totpService.generateToken(totpSecret);
    const disableRes = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/user/totp',
        payload: { code: disableCode },
      },
      authedCookie,
    );
    expect(disableRes.statusCode).toBe(200);

    // Now login again - should succeed immediately without TOTP
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginRes2.statusCode).toBe(200);
    const body = loginRes2.json();
    // User should be logged in without needing 2FA
    expect(body.user.totp_registered).toBe(false);
  });

  test('should return 400 when body is empty', async () => {
    const { pending2FACookie } = await createUserWithTotpAndRecoveryCodes(
      'recovery-empty-body',
    );

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/totp/recovery/verify',
        payload: {},
      },
      pending2FACookie,
    );

    expect(res.statusCode).toBe(400);
  });
});
