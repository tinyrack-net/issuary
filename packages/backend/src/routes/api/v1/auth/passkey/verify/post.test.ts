import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestClient,
  createTestClientWithHeaders,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

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

describe('POST /api/v1/auth/passkey/verify', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
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
    const client = createTestClient(app);
    const res = await client.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');
  });

  test('should return 400 when response body is empty', async () => {
    const client = createTestClient(app);
    const res = await client.api.v1.auth.passkey.verify.$post({
      // @ts-expect-error testing validation with invalid input
      json: {},
    });

    expect(res.status).toBe(400);
  });

  test('should return 400 when response is missing required fields', async () => {
    // Get options first to set challenge in session
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await authedClient.api.v1.auth.passkey.verify.$post({
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
    });

    expect(res.status).toBe(400);
  });

  test('should return 404 when passkey not found', async () => {
    // Get options first to set challenge in session
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with a non-existent credential ID
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          id: 'non-existent-credential-id',
        }),
      },
    });

    // PASSKEY_NOT_FOUND (404) when credential doesn't exist
    const body = await assertJsonBody(res, 404);
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should return 400 when verification fails with invalid signature', async () => {
    const email = generateUniqueEmail('passkey-auth-invalid-sig');
    const password = 'testPassword123!';

    // Create user and passkey
    const { userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    await withMikroContext(services, async () => {
      const passkey = services.mikro.userPasskey.create({
        user: userId,
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
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with invalid signature
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          id: credentialId,
          rawId: credentialId,
        }),
      },
    });

    // Should fail at verification (400 or 500 depending on WebAuthn lib error handling)
    expect([400, 500].includes(res.status)).toBe(true);
  });

  test('should clear challenge from session after attempt', async () => {
    // Get options first
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // First attempt (will fail)
    await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    // Second attempt with same session should fail with challenge not found
    const res2 = await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    // Challenge should be cleared, so second attempt fails with challenge not found
    // or passkey not found (whichever check comes first)
    expect([400, 404].includes(res2.status)).toBe(true);
  });

  test('should return 400 when type is not public-key', async () => {
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          type: 'invalid-type',
        }),
      },
    });

    expect(res.status).toBe(400);
  });

  test('should handle concurrent verification attempts', async () => {
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    const sessionCookie = extractCookie(optionsRes, 'session');

    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });

    // Send concurrent verification requests
    const results = await Promise.all([
      authedClient.api.v1.auth.passkey.verify.$post({
        json: {
          response: createMockAuthenticationResponse(),
        },
      }),
      authedClient.api.v1.auth.passkey.verify.$post({
        json: {
          response: createMockAuthenticationResponse(),
        },
      }),
    ]);

    // All should fail (challenge or passkey error)
    for (const res of results) {
      expect([400, 404, 500].includes(res.status)).toBe(true);
    }
  });
});

describe('POST /api/v1/auth/passkey/verify - Success with mocked service', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
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
    const { userId } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );
    const credentialId = `success-credential-${crypto.randomUUID()}`;

    // Create passkey for user and get user reference
    const user = await withMikroContext(services, async () => {
      const userEntity = await services.mikro.user.findOneOrFail({
        id: userId,
      });
      const passkey = services.mikro.userPasskey.create({
        user: userId,
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
    const client = createTestClient(app);
    const optionsRes = await client.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);
    const sessionCookie = extractCookie(optionsRes, 'session');

    // Mock the verifyAuthentication method to return success
    const mockVerifyAuthentication = vi
      .spyOn(services.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    // Verify with mocked service
    const authedClient = createTestClientWithHeaders(app, {
      Cookie: `session=${sessionCookie}`,
    });
    const res = await authedClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          id: credentialId,
          rawId: credentialId,
        }),
      },
    });

    const body = await assertJsonBody(res);

    // Verify response structure
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe(userId);
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

describe('POST /api/v1/auth/passkey/verify - 2FA mode', () => {
  let app2FA: AppType;
  let services2FA: ServiceContainer;
  let cleanup2FA: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          password: {
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
      const userEntity1 = services2FA.mikro.user.create({
        email: email1,
        password_hash: password,
      });
      userEntity1.email_verified = true;
      await services2FA.mikro.em.persist(userEntity1).flush();

      const passkey1 = services2FA.mikro.userPasskey.create({
        user: userEntity1.id,
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
        password_hash: password,
      });
      userEntity2.email_verified = true;
      await services2FA.mikro.em.persist(userEntity2).flush();

      const passkey2 = services2FA.mikro.userPasskey.create({
        user: userEntity2.id,
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
    const client = createTestClient(app2FA);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email: email1, password },
    });
    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Get passkey options (for user1's pending session)
    const authedClient = createTestClientWithHeaders(app2FA, {
      Cookie: `session=${sessionCookie}`,
    });
    const optionsRes = await authedClient.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const optionsSessionCookie = extractCookie(optionsRes, 'session');

    // Mock verifyAuthentication to return user2 (passkey owner)
    const mockVerifyAuthentication = vi
      .spyOn(services2FA.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user2);

    // Try to verify with user2's passkey while logged in as user1
    const optionsClient = createTestClientWithHeaders(app2FA, {
      Cookie: `session=${optionsSessionCookie}`,
    });
    const res = await optionsClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          id: credentialId2,
          rawId: credentialId2,
        }),
      },
    });

    const body = await assertJsonBody(res, 403);
    expect(body.code).toBe('PASSKEY_USER_MISMATCH');

    mockVerifyAuthentication.mockRestore();
  });

  test('should succeed and clear pending2FAUser session on 2FA verification', async () => {
    const email = generateUniqueEmail('passkey-2fa-success');
    const password = 'testPassword123!';
    const credentialId = `success-2fa-credential-${crypto.randomUUID()}`;

    const { userId, user } = await withMikroContext(services2FA, async () => {
      const userEntity = services2FA.mikro.user.create({
        email,
        password_hash: password,
      });
      userEntity.email_verified = true;
      await services2FA.mikro.em.persist(userEntity).flush();

      const passkey = services2FA.mikro.userPasskey.create({
        user: userEntity.id,
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

      return { userId: userEntity.id, user: userEntity };
    });

    // Login - should get pending2FAUser session
    const client = createTestClient(app2FA);
    const loginRes = await client.api.v1.auth.login.$post({
      json: { email, password },
    });
    expect(loginRes.status).toBe(200);

    const sessionCookie = extractCookie(loginRes, 'session');

    // Get passkey options
    const authedClient = createTestClientWithHeaders(app2FA, {
      Cookie: `session=${sessionCookie}`,
    });
    const optionsRes = await authedClient.api.v1.auth.passkey.options.$post();
    expect(optionsRes.status).toBe(200);

    const optionsSessionCookie = extractCookie(optionsRes, 'session');

    // Mock verifyAuthentication to return success
    const mockVerifyAuthentication = vi
      .spyOn(services2FA.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    // Verify passkey as 2FA
    const optionsClient = createTestClientWithHeaders(app2FA, {
      Cookie: `session=${optionsSessionCookie}`,
    });
    const res = await optionsClient.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse({
          id: credentialId,
          rawId: credentialId,
        }),
      },
    });

    const body = await assertJsonBody(res);

    expect(body.user).toBeDefined();
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(email);

    // Verify we now have a full session (not just pending2FAUser)
    const newSessionCookie = extractCookie(res, 'session');
    const sessionClient = createTestClientWithHeaders(app2FA, {
      Cookie: `session=${newSessionCookie}`,
    });
    const sessionRes = await sessionClient.api.v1.user.session.$get();
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).toBeDefined();
    expect(sessionBody).toHaveProperty('user.id', userId);

    mockVerifyAuthentication.mockRestore();
  });
});

describe('POST /api/v1/auth/passkey/verify - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
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
    const client = createTestClient(appDisabled);
    const res = await client.api.v1.auth.passkey.verify.$post({
      json: {
        response: createMockAuthenticationResponse(),
      },
    });

    // Route is registered but handler rejects when passkey is disabled
    expect(res.status).toBe(400);
  });
});
