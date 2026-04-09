import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../../entrypoints/app.ts';
import { e } from '../../../../../schemas/error.ts';
import type { ServiceContainer } from '../../../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../../../../../test-utils/index.ts';

describe('POST /api/auth/passkey/options', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        passkey: {
          enabled: true,
        },
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should return WebAuthn authentication options', async () => {
    const client = testClient(app);
    const res = await client.api.auth.passkey.options.$post();

    const body = await assertJsonBody(res);

    // Verify response structure matches WebAuthn spec
    expect(body.options).toBeDefined();
    expect(body.options.challenge).toBeDefined();
    expect(typeof body.options.challenge).toBe('string');
    expect(body.options.challenge.length).toBeGreaterThan(10);

    // RP ID
    expect(body.options.rpId).toBeDefined();
    expect(body.options.rpId).toBe('localhost');

    // User verification preference
    expect(body.options.userVerification).toBe('preferred');

    // Timeout
    expect(body.options.timeout).toBeDefined();
    expect(typeof body.options.timeout).toBe('number');

    // allowCredentials should be empty for usernameless authentication
    expect(body.options.allowCredentials).toBeDefined();
    expect(Array.isArray(body.options.allowCredentials)).toBe(true);
    expect(body.options.allowCredentials).toHaveLength(0);
  });

  test('should return unique challenge each time', async () => {
    const client = testClient(app);

    const res1 = await client.api.auth.passkey.options.$post();
    const res2 = await client.api.auth.passkey.options.$post();

    const body1 = await assertJsonBody(res1);
    const body2 = await assertJsonBody(res2);
    const challenge1 = body1.options.challenge;
    const challenge2 = body2.options.challenge;

    expect(challenge1).not.toBe(challenge2);
  });

  test('should store challenge in session for later verification', async () => {
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();

    expect(optionsRes.status).toBe(200);

    // Session cookie should be set
    const setCookie = optionsRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toBeTruthy();
  });

  test('should handle concurrent requests with unique challenges', async () => {
    const client = testClient(app);

    const results = await Promise.all([
      client.api.auth.passkey.options.$post(),
      client.api.auth.passkey.options.$post(),
      client.api.auth.passkey.options.$post(),
    ]);

    // All should succeed
    const bodies = [];
    for (const res of results) {
      const body = await assertJsonBody(res);
      expect(body.options).toBeDefined();
      bodies.push(body);
    }

    // All challenges should be unique
    const challenges = bodies.map((b) => b.options.challenge);
    const uniqueChallenges = new Set(challenges);
    expect(uniqueChallenges.size).toBe(3);
  });

  test('should set correct rpId based on host config', async () => {
    const client = testClient(app);
    const res = await client.api.auth.passkey.options.$post();

    const body = await assertJsonBody(res);

    // rpId should be the hostname from config (localhost in test)
    expect(body.options.rpId).toBe('localhost');
  });
});

describe('POST /api/auth/passkey/options - 2FA mode', () => {
  let app2FA: AppType;
  let services2FA: ServiceContainer;
  let cleanup2FA: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: true,
          two_factor: {
            enrollment_required: true,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    });
    app2FA = server.app;
    services2FA = server.services;
    cleanup2FA = server.cleanup;
  });

  afterAll(async () => {
    await cleanup2FA();
  });

  test('should return options with allowCredentials for pending 2FA user', async () => {
    const email = generateUniqueEmail('passkey-options-2fa');
    const password = 'testPassword123!';
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    // Create user with passkey in DB
    await withMikroContext(services2FA, async () => {
      const passwordHash =
        await services2FA.securityService.hashPassword(password);
      const user = services2FA.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services2FA.mikro.em.persist(user).flush();

      // Add passkey to user
      const passkey = services2FA.mikro.userPasskey.create({
        user: user.sub,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Test Passkey',
        aaguid: 'test-aaguid',
      });
      await services2FA.mikro.em.persist(passkey).flush();
    });

    // Login with password - should get pending2FAUser session (2FA required)
    const client = testClient(app2FA);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });

    const loginBody = await assertJsonBody(loginRes);
    expect(loginBody.user.passkey_count).toBe(1);

    // Get session cookie with pending2FAUser
    const sessionCookie = extractCookie(loginRes, 'session');

    // Now call passkey options - should return allowCredentials for this user
    const authedClient = testClient(app2FA);
    const optionsRes = await authedClient.api.auth.passkey.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(optionsRes);

    // Should have allowCredentials with the user's passkey
    const allowCredentials = body.options.allowCredentials;
    expect(allowCredentials).toBeDefined();
    expect(Array.isArray(allowCredentials)).toBe(true);
    expect(allowCredentials?.length).toBeGreaterThan(0);

    // Verify the credential ID is in the list
    const credentialIds = allowCredentials?.map((c: { id: string }) => c.id);
    expect(credentialIds).toContain(credentialId);
  });

  test('should return empty allowCredentials for passwordless mode', async () => {
    // Create a new app instance just to get options without session
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        passkey: {
          enabled: true,
        },
      },
    });
    const appForTest = server.app;

    try {
      const client = testClient(appForTest);
      const res = await client.api.auth.passkey.options.$post();

      const body = await assertJsonBody(res);

      // Should have empty allowCredentials for discoverable credentials
      expect(body.options.allowCredentials).toBeDefined();
      expect(body.options.allowCredentials).toHaveLength(0);
    } finally {
      await server.cleanup();
    }
  });
});

describe('POST /api/auth/passkey/options - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        passkey: {
          enabled: false,
        },
      },
    });
    appDisabled = server.app;
    cleanupDisabled = server.cleanup;
  });

  afterAll(async () => {
    await cleanupDisabled();
  });

  test('should return 400 when passkey is disabled', async () => {
    const client = testClient(appDisabled);
    const res = await client.api.auth.passkey.options.$post();

    await expectError(res, e.PasskeyNotEnabled);
  });
});

describe('POST /api/auth/passkey/options - Custom rpId', () => {
  let appCustomRpId: AppType;
  let cleanupCustomRpId: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        passkey: {
          enabled: true,
          rp_id: 'custom.example.com',
        },
      },
    });
    appCustomRpId = server.app;
    cleanupCustomRpId = server.cleanup;
  });

  afterAll(async () => {
    await cleanupCustomRpId();
  });

  test('should use custom rp_id from config', async () => {
    const client = testClient(appCustomRpId);
    const res = await client.api.auth.passkey.options.$post();

    const body = await assertJsonBody(res);

    expect(body.options.rpId).toBe('custom.example.com');
  });
});
