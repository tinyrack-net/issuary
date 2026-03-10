import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  enableTotpForUser,
  expectError,
  extractCookie,
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

describe('POST /api/user/totp/recovery/regenerate', () => {
  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.totp.recovery.regenerate.$post({
      json: { code: '123456' },
    });

    await expectError(res, e.Unauthorized);
  });

  test('should regenerate recovery codes and clear the missing flag', async () => {
    const email = generateUniqueEmail('totp-recovery-regenerate');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const secret = await enableTotpForUser(services, userSub);

    const client = testClient(app);

    const sessionBeforeRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBeforeBody = await assertJsonBody(sessionBeforeRes);
    expect(sessionBeforeBody.user?.totp_registered).toBe(true);
    expect(sessionBeforeBody.user?.totp_recovery_codes_missing).toBe(true);

    const regenerateRes = await client.api.user.totp.recovery.regenerate.$post(
      {
        json: { code: services.totpService.generateToken(secret) },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const regenerateBody = await assertJsonBody(regenerateRes);
    expect(regenerateBody.recovery_codes).toHaveLength(8);
    for (const code of regenerateBody.recovery_codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
    }

    const storedRecoveryCodeCount = await withMikroContext(services, async () =>
      services.mikro.userTotpRecoveryCode.countByUserSub(userSub),
    );
    expect(storedRecoveryCodeCount).toBe(8);

    const sessionAfterRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionAfterBody = await assertJsonBody(sessionAfterRes);
    expect(sessionAfterBody.user?.totp_recovery_codes_missing).toBe(false);
  });

  test('should report recovery codes missing when all stored codes are already used', async () => {
    const email = generateUniqueEmail('totp-recovery-exhausted');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ sub: userSub });
      await enableTotpForUser(services, userSub);
      await services.totpService.generateRecoveryCodes(user);

      const recoveryCodes = await services.mikro.userTotpRecoveryCode.find({
        user: { sub: userSub },
      });

      for (const recoveryCode of recoveryCodes) {
        recoveryCode.used = true;
        recoveryCode.used_at = new Date();
      }

      await services.mikro.em.flush();
    });

    const totalRecoveryCodeCount = await withMikroContext(services, async () =>
      services.mikro.userTotpRecoveryCode.countByUserSub(userSub),
    );
    const unusedRecoveryCodeCount = await withMikroContext(services, async () =>
      services.mikro.userTotpRecoveryCode.countUnusedByUserSub(userSub),
    );

    expect(totalRecoveryCodeCount).toBe(8);
    expect(unusedRecoveryCodeCount).toBe(0);

    const client = testClient(app);
    const sessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);

    expect(sessionBody.user?.totp_registered).toBe(true);
    expect(sessionBody.user?.totp_recovery_codes_missing).toBe(true);
  });

  test('should return 400 when the TOTP code is invalid', async () => {
    const email = generateUniqueEmail('totp-recovery-invalid-token');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await enableTotpForUser(services, userSub);

    const client = testClient(app);
    const res = await client.api.user.totp.recovery.regenerate.$post(
      {
        json: { code: '000000' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.InvalidTotpCode);
  });

  test('should invalidate old recovery codes after regeneration', async () => {
    const email = generateUniqueEmail('totp-recovery-old-invalidated');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const secret = await enableTotpForUser(services, userSub);

    // Generate first batch of recovery codes
    const firstBatchHashes = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ sub: userSub });
      await services.totpService.generateRecoveryCodes(user);

      const codes = await services.mikro.userTotpRecoveryCode.find({
        user: { sub: userSub },
      });
      return codes.map((c) => c.code_hash);
    });

    expect(firstBatchHashes).toHaveLength(8);

    // Regenerate recovery codes via the endpoint
    const client = testClient(app);
    const regenerateRes = await client.api.user.totp.recovery.regenerate.$post(
      {
        json: { code: services.totpService.generateToken(secret) },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const regenerateBody = await assertJsonBody(regenerateRes);
    expect(regenerateBody.recovery_codes).toHaveLength(8);

    // Verify old code hashes are no longer in DB
    const currentHashes = await withMikroContext(services, async () => {
      const codes = await services.mikro.userTotpRecoveryCode.find({
        user: { sub: userSub },
      });
      return codes.map((c) => c.code_hash);
    });

    for (const oldHash of firstBatchHashes) {
      expect(currentHashes).not.toContain(oldHash);
    }
  });

  test('should produce usable recovery codes after regeneration', async () => {
    const email = generateUniqueEmail('totp-recovery-usable-codes');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const secret = await enableTotpForUser(services, userSub);

    // Regenerate recovery codes
    const client = testClient(app);
    const regenerateRes = await client.api.user.totp.recovery.regenerate.$post(
      {
        json: { code: services.totpService.generateToken(secret) },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const regenerateBody = await assertJsonBody(regenerateRes);
    const recoveryCodes: string[] = regenerateBody.recovery_codes;
    expect(recoveryCodes).toHaveLength(8);

    // Log in again to get a pending 2FA session
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);
    const pending2FACookie = extractCookie(loginRes, 'session');

    // Use one of the new recovery codes to authenticate
    const firstCode = recoveryCodes[0] ?? '';
    const recoveryRes = await client.api.auth.totp.recovery.verify.$post(
      {
        json: { code: firstCode },
      },
      { headers: { Cookie: `session=${pending2FACookie}` } },
    );

    const recoveryBody = await assertJsonBody(recoveryRes);
    expect(recoveryBody).toHaveProperty('user');
    expect(recoveryBody.user).toHaveProperty('sub');
  });

  test('should return 400 when TOTP is not enabled', async () => {
    const email = generateUniqueEmail('totp-recovery-not-enabled');
    const password = 'testPassword123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    await withMikroContext(services, async () => {
      await services.mikro.userTotpRecoveryCode.deleteByUserSub(userSub);
    });

    const client = testClient(app);
    const res = await client.api.user.totp.recovery.regenerate.$post(
      {
        json: { code: '123456' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.TotpNotEnabled);
  });
});
