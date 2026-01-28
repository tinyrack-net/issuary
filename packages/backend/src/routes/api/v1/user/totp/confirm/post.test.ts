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

/**
 * Helper to verify TOTP setup
 */
async function verifyTotpSetup(
  sessionCookie: string,
  secret: string,
): Promise<string[]> {
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
  return res.json().recovery_codes;
}

describe('POST /api/v1/user/totp/confirm', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/totp/confirm',
      payload: {},
    });

    expectError(res, e.Unauthorized);
  });

  test('should return 400 when TOTP setup was not started', async () => {
    const email = generateUniqueEmail('totp-confirm-no-setup');
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
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotSetup);
  });

  test('should return 400 when TOTP was not verified', async () => {
    const email = generateUniqueEmail('totp-confirm-not-verified');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Start setup but don't verify
    await startTotpSetup(sessionCookie);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );

    expectError(res, e.TotpNotSetup);
  });

  test('should successfully confirm TOTP setup', async () => {
    const email = generateUniqueEmail('totp-confirm-success');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Start and verify setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.totp_registered).toBe(true);

    // Verify TOTP is fully registered in database
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
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
      email,
      password,
    );

    // Complete full setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    // First confirm
    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );
    expect(res1.statusCode).toBe(200);

    // Second confirm should fail
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );

    expectError(res2, e.TotpAlreadyEnabled);
  });

  test('should update session to reflect TOTP enabled status', async () => {
    const email = generateUniqueEmail('totp-confirm-session-update');
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

    // Complete full setup
    const secret = await startTotpSetup(sessionCookie);
    await verifyTotpSetup(sessionCookie, secret);

    // Verify after verify - should still be false
    const sessionAfterVerify = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionAfterVerify.json().user.totp_registered).toBe(false);

    // Confirm
    await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/confirm',
        payload: {},
      },
      sessionCookie,
    );

    // Check session after confirm - TOTP should be enabled
    const sessionAfterConfirm = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/session',
      },
      sessionCookie,
    );
    expect(sessionAfterConfirm.json().user.totp_registered).toBe(true);
  });

  test('full TOTP setup flow: setup -> verify -> confirm', async () => {
    const email = generateUniqueEmail('totp-full-flow');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Step 1: Setup
    const setupRes = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/totp/setup',
      },
      sessionCookie,
    );
    expect(setupRes.statusCode).toBe(200);
    const { secret } = setupRes.json();

    // Verify DB state after setup
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(false);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 2: Verify
    const validCode = app.totpService.generateToken(secret);
    const verifyRes = await injectWithSession(
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
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json()).toHaveProperty('recovery_codes');
    expect(verifyRes.json().recovery_codes.length).toBe(8);

    // Verify DB state after verify
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(false);
    });

    // Step 3: Confirm
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
    expect(confirmRes.json().user.totp_registered).toBe(true);

    // Verify DB state after confirm
    await withMikroContext(app, async () => {
      const totp = await app.mikro.userTotp.findByUserId(userId);
      expect(totp?.verified).toBe(true);
      expect(totp?.recovery_confirmed).toBe(true);
    });
  });
});
