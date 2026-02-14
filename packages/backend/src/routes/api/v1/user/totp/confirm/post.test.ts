import type { AppType } from '@backend/lib/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
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
  const res = await requestWithSession(
    app,
    '/api/v1/user/totp/setup',
    {
      method: 'POST',
    },
    sessionCookie,
  );

  expect(res.status).toBe(200);
  const body = await res.json();
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
  const res = await requestWithSession(
    app,
    '/api/v1/user/totp/verify',
    {
      method: 'POST',
      body: JSON.stringify({
        code: validCode,
      }),
      headers: { 'Content-Type': 'application/json' },
    },
    sessionCookie,
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  return body.recovery_codes;
}

describe('POST /api/v1/user/totp/confirm', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.request('/api/v1/user/totp/confirm', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

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

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

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

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

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

    const res = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
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

    // First confirm
    const res1 = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(res1.status).toBe(200);

    // Second confirm should fail
    const res2 = await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

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

    // Check initial session - TOTP should be disabled
    const sessionBefore = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionBeforeBody = await sessionBefore.json();
    expect(sessionBeforeBody.user.totp_registered).toBe(false);

    // Complete full setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    // Verify after verify - should still be false
    const sessionAfterVerify = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionAfterVerifyBody = await sessionAfterVerify.json();
    expect(sessionAfterVerifyBody.user.totp_registered).toBe(false);

    // Confirm
    await requestWithSession(
      app,
      '/api/v1/user/totp/confirm',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );

    // Check session after confirm - TOTP should be enabled
    const sessionAfterConfirm = await requestWithSession(
      app,
      '/api/v1/user/session',
      {
        method: 'GET',
      },
      sessionCookie,
    );
    const sessionAfterConfirmBody = await sessionAfterConfirm.json();
    expect(sessionAfterConfirmBody.user.totp_registered).toBe(true);
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

    // Step 1: Setup
    const setupRes = await requestWithSession(
      app,
      '/api/v1/user/totp/setup',
      {
        method: 'POST',
      },
      sessionCookie,
    );
    expect(setupRes.status).toBe(200);
    const { secret } = await setupRes.json();

    // Verify DB state after setup
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(false);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 2: Verify
    const validCode = services.totpService.generateToken(secret);
    const verifyRes = await requestWithSession(
      app,
      '/api/v1/user/totp/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          code: validCode,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
      sessionCookie,
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody).toHaveProperty('recovery_codes');
    expect(verifyBody.recovery_codes.length).toBe(8);

    // Verify DB state after verify
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 3: Confirm
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
    const confirmBody = await confirmRes.json();
    expect(confirmBody.user.totp_registered).toBe(true);

    // Verify DB state after confirm
    await withMikroContext(services, async () => {
      const totp = await services.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(true);
    });
  });
});
