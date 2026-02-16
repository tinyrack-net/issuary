import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestClient,
  createTestClientWithHeaders,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
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
 * Helper to start TOTP setup and return secret
 */
async function startTotpSetup(sessionCookie: string): Promise<string> {
  const client = createTestClientWithHeaders(app, {
    Cookie: `session=${sessionCookie}`,
  });
  const res = await client.api.v1.user.totp.setup.$post({});

  const body = await assertJsonBody(res);
  return body.secret;
}

/**
 * Helper to verify TOTP setup
 */
async function verifyTotpSetup(
  sessionCookie: string,
  secret: string,
): Promise<string[]> {
  const validCode = services.totpService.generateToken(secret);
  const client = createTestClientWithHeaders(app, {
    Cookie: `session=${sessionCookie}`,
  });
  const res = await client.api.v1.user.totp.verify.$post({
    json: { code: validCode },
  });

  const body = await assertJsonBody(res);
  return body.recovery_codes;
}

describe('POST /api/v1/user/totp/confirm', () => {
  test('should return 401 when not authenticated', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.user.totp.confirm.$post({ json: {} });

    await expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP setup was not started', async () => {
    const email = generateUniqueEmail('totp-confirm-no-setup');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.user.totp.confirm.$post({ json: {} });

    await expectError(res, e.TotpNotSetup);
  });

  test('should return 400 when TOTP was not verified', async () => {
    const email = generateUniqueEmail('totp-confirm-not-verified');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start setup but don't verify
    await startTotpSetup(sessionCookie);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.user.totp.confirm.$post({ json: {} });

    await expectError(res, e.TotpNotSetup);
  });

  test('should successfully confirm TOTP setup', async () => {
    const email = generateUniqueEmail('totp-confirm-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Start and verify setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await client.api.v1.user.totp.confirm.$post({ json: {} });

    const body = await assertJsonBody(res);
    expect(body).toHaveProperty('user');
    expect(body.user.totp_registered).toBe(true);

    // Verify TOTP is fully registered in database
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp).not.toBeNull();
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(true);
    });
  });

  test('should return 409 when TOTP is already confirmed', async () => {
    const email = generateUniqueEmail('totp-confirm-already-confirmed');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Complete full setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // First confirm
    const res1 = await client.api.v1.user.totp.confirm.$post({ json: {} });
    expect(res1.status).toBe(200);

    // Second confirm should fail
    const res2 = await client.api.v1.user.totp.confirm.$post({ json: {} });

    await expectError(res2, e.TotpAlreadyEnabled);
  });

  test('should update session to reflect TOTP enabled status', async () => {
    const email = generateUniqueEmail('totp-confirm-session-update');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // Check initial session - TOTP should be disabled
    const sessionBefore = await client.api.v1.user.session.$get();
    const sessionBeforeBody = await assertJsonBody(sessionBefore);
    expect(sessionBeforeBody.user).toBeDefined();
    expect(sessionBeforeBody.user?.totp_registered).toBe(false);

    // Complete full setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    // Verify after verify - should still be false
    const sessionAfterVerify = await client.api.v1.user.session.$get();
    const sessionAfterVerifyBody = await assertJsonBody(sessionAfterVerify);
    expect(sessionAfterVerifyBody.user).toBeDefined();
    expect(sessionAfterVerifyBody.user?.totp_registered).toBe(false);

    // Confirm
    await client.api.v1.user.totp.confirm.$post({ json: {} });

    // Check session after confirm - TOTP should be enabled
    const sessionAfterConfirm = await client.api.v1.user.session.$get();
    const sessionAfterConfirmBody = await assertJsonBody(sessionAfterConfirm);
    expect(sessionAfterConfirmBody.user).toBeDefined();
    expect(sessionAfterConfirmBody.user?.totp_registered).toBe(true);
  });

  test('full TOTP setup flow: setup -> verify -> confirm', async () => {
    const email = generateUniqueEmail('totp-full-flow');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // Step 1: Setup
    const setupRes = await client.api.v1.user.totp.setup.$post({});
    const setupBody = await assertJsonBody(setupRes);
    const { secret } = setupBody;

    // Verify DB state after setup
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(false);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 2: Verify
    const validCode = services.totpService.generateToken(secret);
    const verifyRes = await client.api.v1.user.totp.verify.$post({
      json: { code: validCode },
    });
    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toHaveProperty('recovery_codes');
    expect(verifyBody.recovery_codes.length).toBe(8);

    // Verify DB state after verify
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 3: Confirm
    const confirmRes = await client.api.v1.user.totp.confirm.$post({
      json: {},
    });
    const confirmBody = await assertJsonBody(confirmRes);
    expect(confirmBody.user.totp_registered).toBe(true);

    // Verify DB state after confirm
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(true);
    });
  });
});
