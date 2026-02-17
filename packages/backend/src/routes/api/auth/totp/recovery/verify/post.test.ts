import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  expectError,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

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
  const setupClient = testClient(app);
  const setupRes = await setupClient.api.user.totp.setup.$post(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const setupBody = await assertJsonBody(setupRes);
  const totpSecret = setupBody.secret;

  // Verify TOTP setup (this generates recovery codes)
  const validCode = services.totpService.generateToken(totpSecret);
  const verifyRes = await setupClient.api.user.totp.verify.$post(
    {
      json: { code: validCode },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const verifyBody = await assertJsonBody(verifyRes);
  const recoveryCodes = verifyBody.recovery_codes;
  expect(recoveryCodes).toHaveLength(8);

  // Confirm TOTP setup (acknowledge recovery codes)
  const confirmRes = await setupClient.api.user.totp.confirm.$post(
    {
      json: {},
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  expect(confirmRes.status).toBe(200);

  // Now login again to get a pending 2FA session
  const client = testClient(app);
  const loginRes = await client.api.auth.login.$post({
    json: { email, password },
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

describe('POST /api/auth/totp/recovery/verify', () => {
  test('should successfully authenticate with a valid recovery code', async () => {
    const { pending2FACookie, recoveryCodes } =
      await createUserWithTotpAndRecoveryCodes('recovery-success');

    const client = testClient(app);
    const res = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: recoveryCodes[0] ?? '' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );

    const body = await assertJsonBody(res);
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
      const client = testClient(app);
      const res1 = await client.api.auth.totp.recovery.verify.$post(
        {
          json: { code },
        },
        { headers: { Cookie: `session=${pending2FACookie}` } },
      );
      expect(res1.status).toBe(200);

      // Login again to get a new pending 2FA session
      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: { email, password },
      });
      expect(loginRes.status).toBe(200);
      const newCookie = extractCookie(loginRes, 'session');

      // Second use of same code should fail
      const newClient = testClient(app);
      const res2 = await newClient.api.auth.totp.recovery.verify.$post(
        {
          json: { code },
        },
        { headers: { Cookie: `session=${newCookie}` } },
      );
      await expectError(res2, e.InvalidRecoveryCode);
    },
  );

  test('should reject invalid recovery code', { timeout: 30000 }, async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-invalid');

    const client = testClient(app);
    const res = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: 'aaaa-zzzz' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );

    await expectError(res, e.InvalidRecoveryCode);
  });

  test('should return 401 when no pending 2FA session', async () => {
    const client = testClient(app);
    const res = await client.api.auth.totp.recovery.verify.$post({
      json: { code: 'abcd-ef12' },
    });

    await expectError(res, e.Unauthorized);
  });

  test('should validate code format', async () => {
    const { pending2FACookie } =
      await createUserWithTotpAndRecoveryCodes('recovery-format');

    const client = testClient(app);

    // Missing hyphen
    const res1 = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: 'abcdefgh' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(res1.status).toBe(400);

    // Too short
    const res2 = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: 'abc-def' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(res2.status).toBe(400);

    // Uppercase (should not match pattern)
    const res3 = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: 'ABCD-EF12' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(res3.status).toBe(400);
  });

  test('should allow using different recovery codes', async () => {
    const { pending2FACookie, recoveryCodes, email, password } =
      await createUserWithTotpAndRecoveryCodes('recovery-multiple');

    // Use first code
    const client = testClient(app);
    const res1 = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: recoveryCodes[0] ?? '' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(res1.status).toBe(200);

    // Login again and use second code
    const loginClient = testClient(app);
    const loginRes = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const newClient = testClient(app);
    const res2 = await newClient.api.auth.totp.recovery.verify.$post(
      {
        json: { code: recoveryCodes[1] ?? '' },
      },
      { headers: { Cookie: `session=${newCookie}` } },
    );
    expect(res2.status).toBe(200);
  });

  test('should mark recovery code as used in database', async () => {
    const { pending2FACookie, recoveryCodes, userId } =
      await createUserWithTotpAndRecoveryCodes('recovery-db-mark');

    const client = testClient(app);
    await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: recoveryCodes[0] ?? '' },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
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

    const authedClient = testClient(app);

    // Setup TOTP
    const setupRes = await authedClient.api.user.totp.setup.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const setupBody = await assertJsonBody(setupRes);
    const totpSecret = setupBody.secret;

    // Verify setup
    const validCode = services.totpService.generateToken(totpSecret);
    const verifyRes = await authedClient.api.user.totp.verify.$post(
      {
        json: { code: validCode },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody.recovery_codes).toHaveLength(8);

    // Confirm recovery codes saved
    const confirmRes = await authedClient.api.user.totp.confirm.$post(
      {
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
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
    const disableRes = await authedClient.api.user.totp.$delete(
      {
        json: { code: disableCode },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
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
      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: { email, password },
      });
      const cookie = extractCookie(loginRes, 'session');

      const client = testClient(app);
      const res = await client.api.auth.totp.recovery.verify.$post(
        {
          json: { code: recoveryCodes[i] ?? '' },
        },
        {
          headers: {
            Cookie: `session=${i === 0 ? pending2FACookie : cookie}`,
          },
        },
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
    const loginClient = testClient(app);
    const loginRes = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    const newCookie = extractCookie(loginRes, 'session');

    const client = testClient(app);
    const res = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: 'abcd-1234' },
      },
      { headers: { Cookie: `session=${newCookie}` } },
    );
    await expectError(res, e.NoRecoveryCodesAvailable);
  });

  test('should fail recovery code login after TOTP is disabled', async () => {
    const { email, password, totpSecret } =
      await createUserWithTotpAndRecoveryCodes('recovery-after-disable');

    // Get authenticated session (not pending 2FA)
    const loginClient = testClient(app);
    const loginRes1 = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    const pending2FACookie = extractCookie(loginRes1, 'session');

    // Use TOTP to complete login
    const totpCode = services.totpService.generateToken(totpSecret);
    const pendingClient = testClient(app);
    const totpVerifyRes = await pendingClient.api.auth.totp.verify.$post(
      {
        json: { code: totpCode },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );
    expect(totpVerifyRes.status).toBe(200);
    const authedCookie = extractCookie(totpVerifyRes, 'session');

    // Disable TOTP with authenticated session
    const disableCode = services.totpService.generateToken(totpSecret);
    const authedClient = testClient(app);
    const disableRes = await authedClient.api.user.totp.$delete(
      {
        json: { code: disableCode },
      },
      { headers: { Cookie: `session=${authedCookie}` } },
    );
    expect(disableRes.status).toBe(200);

    // Now login again - should succeed immediately without TOTP
    const loginRes2 = await loginClient.api.auth.login.$post({
      json: { email, password },
    });
    const body = await assertJsonBody(loginRes2);
    // User should be logged in without needing 2FA
    expect(body.user.totp_registered).toBe(false);
  });

  test('should return 400 when body is empty', async () => {
    const { pending2FACookie } = await createUserWithTotpAndRecoveryCodes(
      'recovery-empty-body',
    );

    const client = testClient(app);
    const res = await client.api.auth.totp.recovery.verify.$post(
      {
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );

    expect(res.status).toBe(400);
  });
});
