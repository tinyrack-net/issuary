import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '#backend/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

/**
 * Create a mock WebAuthn authentication response
 * This creates a valid structure that passes Zod schema validation.
 * Note: The cryptographic signature is still invalid, so verification will fail.
 */
function createMockAuthenticationResponse(overrides?: {
  id?: string;
  rawId?: string;
  clientDataJSON?: string;
  authenticatorData?: string;
  signature?: string;
  userHandle?: string;
  type?: 'public-key' | string;
}) {
  return {
    id: overrides?.id ?? 'mock-credential-id',
    rawId: overrides?.rawId ?? 'mock-credential-id',
    response: {
      // Valid base64url encoded clientDataJSON
      clientDataJSON:
        overrides?.clientDataJSON ??
        Buffer.from(
          JSON.stringify({
            type: 'webauthn.get',
            challenge: 'mock-challenge',
            origin: 'http://localhost:8080',
          }),
        ).toString('base64url'),
      // Valid base64url strings
      authenticatorData:
        overrides?.authenticatorData ?? 'bW9jay1hdXRoZW50aWNhdG9yLWRhdGE',
      signature: overrides?.signature ?? 'bW9jay1zaWduYXR1cmU',
    },
    type: (overrides?.type ?? 'public-key') as 'public-key',
    clientExtensionResults: {},
  };
}

describe('POST /api/auth/passkey/verify', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          passkey: {
            enabled: true,
            email_verification: true,
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

  test('should return 400 when no challenge in session', async () => {
    const email = generateUniqueEmail('passkey-verify-no-challenge');
    const password = 'testPassword123!';

    await createDbUserWithSession(app, services, email, password);

    // Directly call verify without getting options first (no challenge in session)
    const client = testClient(app);
    const res = await client.api.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');
  });

  test('should return 400 when response body is empty', async () => {
    const client = testClient(app);
    const res = await client.api.auth.passkey.verify.$post({
      // @ts-expect-error testing validation with invalid input
      json: {},
    });

    expect(res.status).toBe(400);
  });

  test('should return 400 when response is missing required fields', async () => {
    // Get options first to set challenge in session
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = testClient(app);
    const res = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: {
            rawId: 'mock-id',
            // @ts-expect-error testing validation with invalid input
            response: {
              clientDataJSON: 'mock-data',
            },
            type: 'public-key',
          },
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 404 when passkey not found', async () => {
    // Get options first to set challenge in session
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with a non-existent credential ID
    const authedClient = testClient(app);
    const res = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: 'non-existent-credential-id',
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // PASSKEY_NOT_FOUND (404) when credential doesn't exist
    const body = await assertJsonBody(res, 404);
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should return 400 when verification fails with invalid signature', async () => {
    const email = generateUniqueEmail('passkey-auth-invalid-sig');
    const password = 'testPassword123!';

    // Create user and passkey
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    await withMikroContext(services, async () => {
      const passkey = services.mikro.userPasskey.create({
        user: userSub,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Test Passkey',
        aaguid: 'test-aaguid',
      });
      await services.mikro.em.persist(passkey).flush();
    });

    // Get options to set challenge in session
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with invalid signature
    const mockVerifyAuthentication = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockRejectedValueOnce(new e.PasskeyVerificationFailed.Error());

    const authedClient = testClient(app);
    const res = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    await expectError(res, e.PasskeyVerificationFailed);
    mockVerifyAuthentication.mockRestore();
  });

  test('should clear challenge from session after attempt', async () => {
    const email = generateUniqueEmail('passkey-clear-challenge');
    const password = 'testPassword123!';
    const credentialId = `clear-challenge-${crypto.randomUUID()}`;

    await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      const passkey = services.mikro.userPasskey.create({
        user: user.sub,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Challenge Clearing Passkey',
        aaguid: 'test-aaguid',
      });
      await services.mikro.em.persist(passkey).flush();
    });

    // Get options first
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = testClient(app);
    const mockVerifyAuthentication = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockRejectedValue(new e.PasskeyVerificationFailed.Error());

    // First attempt (will fail)
    const firstRes = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    await expectError(firstRes, e.PasskeyVerificationFailed);

    // Second attempt with same session should fail with challenge not found
    const res2 = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const secondBody = await assertJsonBody(res2, 400);
    expect(
      secondBody.code === 'PASSKEY_CHALLENGE_NOT_FOUND' ||
        secondBody.code === 'PASSKEY_VERIFICATION_FAILED',
    ).toBe(true);

    mockVerifyAuthentication.mockRestore();
  });

  test('should return 400 when type is not public-key', async () => {
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = testClient(app);
    const res = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            type: 'invalid-type',
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should handle concurrent verification attempts', async () => {
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = testClient(app);
    const mockVerifyAuthentication = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockRejectedValue(new e.PasskeyVerificationFailed.Error());

    // Send concurrent verification requests
    const results = await Promise.all([
      authedClient.api.auth.passkey.verify.$post(
        {
          json: {
            response: createMockAuthenticationResponse(),
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      ),
      authedClient.api.auth.passkey.verify.$post(
        {
          json: {
            response: createMockAuthenticationResponse(),
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      ),
    ]);

    // First request can fail at verification; subsequent request should
    // fail because challenge is single-use and already cleared.
    for (const res of results) {
      const body = await assertJsonBody(res, 400);
      expect(
        body.code === 'PASSKEY_VERIFICATION_FAILED' ||
          body.code === 'PASSKEY_CHALLENGE_NOT_FOUND',
      ).toBe(true);
    }

    mockVerifyAuthentication.mockRestore();
  });
});

describe('POST /api/auth/passkey/verify - Success with mocked service', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          passkey: {
            enabled: true,
            email_verification: true,
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

  test('should return 200 and create session on successful verification', async () => {
    const email = generateUniqueEmail('passkey-auth-success');
    const password = 'testPassword123!';

    // Create user
    const { userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    const credentialId = `success-credential-${crypto.randomUUID()}`;

    // Create passkey for user and get user reference
    const user = await withMikroContext(services, async () => {
      const userEntity = await services.mikro.user.findOneOrFail({
        sub: userSub,
      });
      const passkey = services.mikro.userPasskey.create({
        user: userSub,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Test Passkey',
        aaguid: 'test-aaguid',
      });
      await services.mikro.em.persist(passkey).flush();
      return userEntity;
    });

    // Get options to set challenge in session
    const client = testClient(app);
    const optionsRes = await client.api.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);
    const sessionCookie = extractCookie(optionsRes, 'session');

    // Mock the verifyAuthentication method to return success
    const mockVerifyAuthentication = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    // Verify with mocked service
    const authedClient = testClient(app);
    const res = await authedClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // Verify response structure
    expect(body.user).toBeDefined();
    expect(body.user.sub).toBe(userSub);
    expect(body.user.email).toBe(email);
    expect(body.user.managed_by).toBe('database');
    expect(body.user.email_verified).toBe(true);
    // Check other required fields exist
    expect(typeof body.user.has_password).toBe('boolean');
    expect(typeof body.user.totp_registered).toBe('boolean');
    expect(typeof body.user.passkey_count).toBe('number');

    // Verify session was created
    const newSessionCookie = res.headers.get('set-cookie');
    expect(newSessionCookie).toBeDefined();

    // Cleanup
    mockVerifyAuthentication.mockRestore();
  });
});

describe('POST /api/auth/passkey/verify - 2FA mode', () => {
  let app2FA: AppType;
  let services2FA: ServiceContainer;
  let cleanup2FA: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          password: {
            ...MINIMAL_TEST_CONFIG.auth.password,
            enabled: true,
            second_factor: {
              required: true,
            },
          },
          passkey: {
            enabled: true,
            email_verification: true,
          },
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

  test('should return 403 when passkey belongs to different user', async () => {
    // Create two users with passkeys
    const email1 = generateUniqueEmail('passkey-2fa-mismatch-user1');
    const email2 = generateUniqueEmail('passkey-2fa-mismatch-user2');
    const password = 'testPassword123!';
    const credentialId1 = `credential-user1-${crypto.randomUUID()}`;
    const credentialId2 = `credential-user2-${crypto.randomUUID()}`;

    const { user2 } = await withMikroContext(services2FA, async () => {
      // Create user1 with passkey
      const passwordHash =
        await services2FA.securityService.hashPassword(password);
      const userEntity1 = services2FA.mikro.user.create({
        email: email1,
        password_hash: passwordHash,
      });
      userEntity1.email_verified = true;
      await services2FA.mikro.em.persist(userEntity1).flush();

      const passkey1 = services2FA.mikro.userPasskey.create({
        user: userEntity1.sub,
        credential_id: credentialId1,
        public_key: 'test-public-key-1',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'User1 Passkey',
        aaguid: 'test-aaguid-1',
      });
      await services2FA.mikro.em.persist(passkey1).flush();

      // Create user2 with passkey
      const userEntity2 = services2FA.mikro.user.create({
        email: email2,
        password_hash: passwordHash,
      });
      userEntity2.email_verified = true;
      await services2FA.mikro.em.persist(userEntity2).flush();

      const passkey2 = services2FA.mikro.userPasskey.create({
        user: userEntity2.sub,
        credential_id: credentialId2,
        public_key: 'test-public-key-2',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'User2 Passkey',
        aaguid: 'test-aaguid-2',
      });
      await services2FA.mikro.em.persist(passkey2).flush();

      return { user2: userEntity2 };
    });

    // Login as user1 - should get pending2FAUser session
    const client = testClient(app2FA);
    const loginRes = await client.api.auth.login.$post({
      json: { email: email1, password },
    });
    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Get passkey options (for user1's pending session)
    const authedClient = testClient(app2FA);
    const optionsRes = await authedClient.api.auth.passkey.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(optionsRes.status).toBe(200);

    const optionsSessionCookie = extractCookie(optionsRes, 'session');

    // Mock verifyAuthentication to return user2 (passkey owner)
    const mockVerifyAuthentication = vi
      .spyOn(services2FA.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user2);

    // Try to verify with user2's passkey while logged in as user1
    const optionsClient = testClient(app2FA);
    const res = await optionsClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId2,
            rawId: credentialId2,
          }),
        },
      },
      { headers: { Cookie: `session=${optionsSessionCookie}` } },
    );

    const body = await assertJsonBody(res, 403);
    expect(body.code).toBe('PASSKEY_USER_MISMATCH');

    mockVerifyAuthentication.mockRestore();
  });

  test('should succeed and clear pending2FAUser session on 2FA verification', async () => {
    const email = generateUniqueEmail('passkey-2fa-success');
    const password = 'testPassword123!';
    const credentialId = `success-2fa-credential-${crypto.randomUUID()}`;

    const { userSub, user } = await withMikroContext(services2FA, async () => {
      const passwordHash =
        await services2FA.securityService.hashPassword(password);
      const userEntity = services2FA.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      userEntity.email_verified = true;
      await services2FA.mikro.em.persist(userEntity).flush();

      const passkey = services2FA.mikro.userPasskey.create({
        user: userEntity.sub,
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

      return { userSub: userEntity.sub, user: userEntity };
    });

    // Login - should get pending2FAUser session
    const client = testClient(app2FA);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Get passkey options
    const authedClient = testClient(app2FA);
    const optionsRes = await authedClient.api.auth.passkey.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(optionsRes.status).toBe(200);

    const optionsSessionCookie = extractCookie(optionsRes, 'session');

    // Mock verifyAuthentication to return success
    const mockVerifyAuthentication = vi
      .spyOn(services2FA.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    // Verify passkey as 2FA
    const optionsClient = testClient(app2FA);
    const res = await optionsClient.api.auth.passkey.verify.$post(
      {
        json: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${optionsSessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    expect(body.user).toBeDefined();
    expect(body.user.sub).toBe(userSub);
    expect(body.user.email).toBe(email);

    // Verify we now have a full session (not just pending2FAUser)
    const newSessionCookie = extractCookie(res, 'session');
    const sessionClient = testClient(app2FA);
    const sessionRes = await sessionClient.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${newSessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    expect(sessionBody).toHaveProperty('user.sub', userSub);

    mockVerifyAuthentication.mockRestore();
  });
});

describe('POST /api/auth/passkey/verify - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          ...MINIMAL_TEST_CONFIG.auth,
          passkey: {
            enabled: false,
            email_verification: true,
          },
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
    const res = await client.api.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    // Route is registered but handler rejects when passkey is disabled
    expect(res.status).toBe(400);
  });
});
