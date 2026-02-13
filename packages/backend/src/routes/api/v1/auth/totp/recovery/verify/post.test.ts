import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createDbUserWithSession,
  expectError,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
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
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
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
    services,
    email,
    password,
  );

  // Start TOTP setup
  const setupRes = await requestWithSession(
    app,
    '/api/v1/user/totp/setup',
    { method: 'POST' },
    sessionCookie,
  );
  expect(setupRes.status).toBe(200);
  const setupBody = await setupRes.json();
  const totpSecret = setupBody.secret;

  // Verify TOTP setup (this generates recovery codes)
  const validCode = services.totpService.generateToken(totpSecret);
  const verifyRes = await requestWithSession(
    app,
    '/api/v1/user/totp/verify',
    {
      method: 'POST',
      body: JSON.stringify({ code: validCode }),
      headers: { 'Content-Type': 'application/json' },
    },
    sessionCookie,
  );
  expect(verifyRes.status).toBe(200);
  const verifyBody = await verifyRes.json();
  const recoveryCodes = verifyBody.recovery_codes;
  expect(recoveryCodes).toHaveLength(8);

  // Confirm TOTP setup (acknowledge recovery codes)
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

  // Now login again to get a pending 2FA session
  const loginRes = await app.request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(loginRes.status).toBe(200);
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

    const res = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: recoveryCodes[0] }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
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
      const res1 = await requestWithSession(
        app,
        '/api/v1/auth/totp/recovery/verify',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
          headers: { 'Content-Type': 'application/json' },
        },
        pending2FACookie,
      );
      expect(res1.status).toBe(200);

      // Login again to get a new pending 2FA session
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loginRes.status).toBe(200);
      const newCookie = extractCookie(loginRes, 'session');

      // Second use of same code should fail
      const res2 = await requestWithSession(
        app,
        '/api/v1/auth/totp/recovery/verify',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
          headers: { 'Content-Type': 'application/json' },
        },
        newCookie,
      );
      await expectError(res2, e.InvalidRecoveryCode);
    },
  );

  test('should reject invalid recovery code', { timeout: 30000 }, async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-invalid');

    const res = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'aaaa-zzzz' }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );

    await expectError(res, e.InvalidRecoveryCode);
  });

  test('should return 401 when no pending 2FA session', async () => {
    const res = await app.request('/api/v1/auth/totp/recovery/verify', {
      method: 'POST',
      body: JSON.stringify({ code: 'abcd-ef12' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.SecondFactorSessionExpired);
  });

  test('should validate code format', async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-format');

    // Missing hyphen
    const res1 = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'abcdefgh' }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );
    expect(res1.status).toBe(400);

    // Too short
    const res2 = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'abc-def' }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );
    expect(res2.status).toBe(400);

    // Uppercase (should not match pattern)
    const res3 = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'ABCD-EF12' }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );
    expect(res3.status).toBe(400);
  });

  test('should allow using different recovery codes', async () => {
    const { pending2FACookie, recoveryCodes, email, password } =
      await createUserWithTotpAndRecoveryCodes('recovery-multiple');

    // Use first code
    const res1 = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: recoveryCodes[0] }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );
    expect(res1.status).toBe(200);

    // Login again and use second code
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const res2 = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: recoveryCodes[1] }),
        headers: { 'Content-Type': 'application/json' },
      },
      newCookie,
    );
    expect(res2.status).toBe(200);
  });

  test('should mark recovery code as used in database', async () => {
    const { pending2FACookie, recoveryCodes, userId } =
      await createUserWithTotpAndRecoveryCodes('recovery-db-mark');

    await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: recoveryCodes[0] }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );

    // Verify in database that one code is marked as used
    await withMikroContext(services, async () => {
      const unusedCodes =
        await services.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(unusedCodes).toHaveLength(7); // 8 - 1 = 7

      const allCodes = await services.mikro.userTotpRecoveryCode.find({
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
      services,
      email,
      password,
    );

    // Setup TOTP
    const setupRes = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      { method: 'POST' },
      sessionCookie,
    );
    const setupBody = await setupRes.json();
    const totpSecret = setupBody.secret;

    // Verify setup
    const validCode = services.totpService.generateToken(totpSecret);
    const verifyRes = await requestWithSession(
      app,
      '/api/v1/user/totp/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: validCode }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.recovery_codes).toHaveLength(8);

    // Confirm recovery codes saved
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

    // Verify recovery codes exist
    await withMikroContext(services, async () => {
      const codes =
        await services.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(codes).toHaveLength(8);
    });

    // Disable TOTP
    const disableCode = services.totpService.generateToken(totpSecret);
    const disableRes = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({ code: disableCode }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(disableRes.status).toBe(200);

    // Verify recovery codes are deleted
    await withMikroContext(services, async () => {
      const codes =
        await services.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(codes).toHaveLength(0);
    });
  });

  test('should return NoRecoveryCodesAvailable when all codes are used', async () => {
    const { pending2FACookie, recoveryCodes, email, password, userId } =
      await createUserWithTotpAndRecoveryCodes('recovery-exhausted');

    // Use all 8 recovery codes
    for (let i = 0; i < 8; i++) {
      // Login to get pending 2FA session
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      const cookie = extractCookie(loginRes, 'session');

      const res = await requestWithSession(
        app,
        '/api/v1/auth/totp/recovery/verify',
        {
          method: 'POST',
          body: JSON.stringify({ code: recoveryCodes[i] }),
          headers: { 'Content-Type': 'application/json' },
        },
        i === 0 ? pending2FACookie : cookie,
      );
      expect(res.status).toBe(200);
    }

    // Verify all codes are used in database
    await withMikroContext(services, async () => {
      const unusedCodes =
        await services.mikro.userTotpRecoveryCode.findUnusedByUserId(userId);
      expect(unusedCodes).toHaveLength(0);
    });

    // Login again and try to use a recovery code
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const res = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: 'abcd-1234' }),
        headers: { 'Content-Type': 'application/json' },
      },
      newCookie,
    );
    await expectError(res, e.NoRecoveryCodesAvailable);
  });

  test('should fail recovery code login after TOTP is disabled', async () => {
    const { email, password, totpSecret } =
      await createUserWithTotpAndRecoveryCodes('recovery-after-disable');

    // Get authenticated session (not pending 2FA)
    const loginRes1 = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    const pending2FACookie = extractCookie(loginRes1, 'session');

    // Use TOTP to complete login
    const totpCode = services.totpService.generateToken(totpSecret);
    const totpVerifyRes = await requestWithSession(
      app,
      '/api/v1/auth/totp/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );
    expect(totpVerifyRes.status).toBe(200);
    const authedCookie = extractCookie(totpVerifyRes, 'session');

    // Disable TOTP with authenticated session
    const disableCode = services.totpService.generateToken(totpSecret);
    const disableRes = await requestWithSession(
      app,
      '/api/v1/user/totp',
      {
        method: 'DELETE',
        body: JSON.stringify({ code: disableCode }),
        headers: { 'Content-Type': 'application/json' },
      },
      authedCookie,
    );
    expect(disableRes.status).toBe(200);

    // Now login again - should succeed immediately without TOTP
    const loginRes2 = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes2.status).toBe(200);
    const body = await loginRes2.json();
    // User should be logged in without needing 2FA
    expect(body.user.totp_registered).toBe(false);
  });

  test('should return 400 when body is empty', async () => {
    const { pending2FACookie } = await createUserWithTotpAndRecoveryCodes(
      'recovery-empty-body',
    );

    const res = await requestWithSession(
      app,
      '/api/v1/auth/totp/recovery/verify',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      pending2FACookie,
    );

    expect(res.status).toBe(400);
  });
});
