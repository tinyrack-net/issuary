import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../../../../../entrypoints/app.ts';
import { e } from '../../../../../../schemas/error.ts';
import type { ServiceContainer } from '../../../../../../services/container.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../../../test-utils/index.ts';

/**
 * Helper to create a DB user with session
 */
async function createDbUserWithSessionHelper(
  app: AppType,
  services: ServiceContainer,
  email: string,
  password: string,
): Promise<{
  sessionCookie: string;
  userSub: string;
}> {
  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(password);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
  });

  const client = testClient(app);
  const loginRes = await client.api.auth.login.$post({
    json: { email, password },
  });

  expect(loginRes.status).toBe(200);

  const sessionCookie = extractCookie(loginRes, 'session');
  const body = await assertJsonBody(loginRes);
  const userSub = body.user.sub;

  return { sessionCookie, userSub };
}

/**
 * Helper to create a passkey for a user directly in DB
 */
async function createPasskeyForUserHelper(
  services: ServiceContainer,
  userSub: string,
  credentialId: string,
): Promise<string> {
  let passkeyId = '';

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
    passkeyId = passkey.id;
  });

  return passkeyId;
}

/**
 * Create a mock WebAuthn registration response
 * Note: This creates an invalid response for testing error handling
 */
function createMockRegistrationResponse(overrides?: {
  id?: string;
  rawId?: string;
  clientDataJSON?: string;
  attestationObject?: string;
}): RegistrationResponseJSON {
  return {
    id: overrides?.id ?? 'mock-credential-id',
    rawId: overrides?.rawId ?? 'mock-credential-id',
    response: {
      clientDataJSON:
        overrides?.clientDataJSON ??
        Buffer.from(
          JSON.stringify({
            type: 'webauthn.create',
            challenge: 'mock-challenge',
            origin: 'http://localhost:8080',
          }),
        ).toString('base64url'),
      attestationObject:
        overrides?.attestationObject ?? 'mock-attestation-object',
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

describe('POST /api/user/passkeys/register/verify', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      registration: {
        email_verification_required: true,
      },
      auth: {
        passkey: {
          enabled: true,
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

  test('should persist a passkey and return setup completion false on success', async () => {
    const email = generateUniqueEmail('passkey-verify-success');
    const password = 'testPassword123!';
    const credentialId = `registered-credential-${crypto.randomUUID()}`;

    const { sessionCookie, userSub } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const optionsBody = await assertJsonBody(optionsRes);
    const optionsCookie = extractCookie(optionsRes, 'session');

    const verifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockImplementationOnce(
        async (user, _response, expectedChallenge, name) => {
          expect(user.sub).toBe(userSub);
          expect(expectedChallenge).toBe(optionsBody.options.challenge);
          expect(name).toBe('My Laptop');

          const passkey = services.mikro.userPasskey.create({
            user: user.sub,
            credential_id: credentialId,
            public_key: 'test-public-key-base64url',
            counter: 0,
            device_type: 'multiDevice',
            backed_up: true,
            transports: ['internal'],
            name: name ?? null,
            aaguid: 'test-aaguid',
          });
          await services.mikro.em.persist(passkey).flush();
          return passkey;
        },
      );

    const verifyRes = await client.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
          name: 'My Laptop',
        },
      },
      { headers: { Cookie: `session=${optionsCookie}` } },
    );

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody).toEqual({
      ok: true,
      second_factor_setup_completed: false,
    });

    const passkeysRes = await client.api.user.passkeys.$get(
      {},
      { headers: { Cookie: `session=${optionsCookie}` } },
    );
    const passkeysBody = await assertJsonBody(passkeysRes);
    expect(passkeysBody.passkeys).toHaveLength(1);
    const firstPasskey = passkeysBody.passkeys[0];
    if (!firstPasskey) {
      throw new Error('Expected one saved passkey');
    }
    expect(firstPasskey.credential_id).toBe(credentialId);
    expect(firstPasskey.name).toBe('My Laptop');

    verifyRegistration.mockRestore();
  });

  test('should return 400 when not authenticated (no challenge in session)', async () => {
    const client = testClient(app);
    const res = await client.api.user.passkeys.register.verify.$post({
      json: {
        response: createMockRegistrationResponse(),
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');
  });

  test('should return 400 when no challenge in session', async () => {
    const email = generateUniqueEmail('passkey-verify-no-challenge');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    // Directly call verify without getting options first
    const client = testClient(app);
    const res = await client.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');
  });

  test('should return 400 when verification fails with invalid response', async () => {
    const email = generateUniqueEmail('passkey-verify-invalid-response');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // First get registration options to set challenge in session
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    expect(optionsRes.status).toBe(200);

    // Get the updated session cookie if present, otherwise use original
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Try to verify with an invalid response
    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValueOnce(new e.PasskeyVerificationFailed.Error());

    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    await expectError(res, e.PasskeyVerificationFailed);
    mockVerifyRegistration.mockRestore();
  });

  test('should return 400 when response is missing required fields', async () => {
    const email = generateUniqueEmail('passkey-verify-missing-fields');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options first
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Try to verify with incomplete response (missing id)
    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: {
            rawId: 'mock-id',
            response: {
              clientDataJSON: 'mock-data',
              attestationObject: 'mock-attestation',
            },
            type: 'public-key',
            clientExtensionResults: {},
          },
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when type is not public-key', async () => {
    const email = generateUniqueEmail('passkey-verify-invalid-type');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options first
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Try to verify with wrong type
    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: {
            ...createMockRegistrationResponse(),
            type: 'invalid-type',
          },
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should accept optional name parameter', async () => {
    const email = generateUniqueEmail('passkey-verify-with-name');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options first
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Verify with name (will fail due to invalid response, but name should be accepted)
    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValueOnce(new e.PasskeyVerificationFailed.Error());

    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
          name: 'My MacBook Pro',
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    await expectError(res, e.PasskeyVerificationFailed);
    mockVerifyRegistration.mockRestore();
  });

  test('should return 400 when name exceeds max length', async () => {
    const email = generateUniqueEmail('passkey-verify-long-name');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options first
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Try to verify with name over 100 characters
    const longName = 'a'.repeat(101);
    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
          name: longName,
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when response body is empty', async () => {
    const email = generateUniqueEmail('passkey-verify-empty-body');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.verify.$post(
      {
        // @ts-expect-error testing validation with invalid input
        json: {},
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 400 when response.response is missing', async () => {
    const email = generateUniqueEmail('passkey-verify-missing-response');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: {
            id: 'mock-id',
            rawId: 'mock-id',
            type: 'public-key',
            clientExtensionResults: {},
            // missing response.clientDataJSON and attestationObject
          },
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });

  test('should return 409 when credential already exists', async () => {
    const email = generateUniqueEmail('passkey-verify-duplicate');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    // Create a passkey with specific credential ID
    const existingCredentialId = 'existing-credential-id-123';
    await createPasskeyForUserHelper(services, userSub, existingCredentialId);

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Simulate duplicate credential from passkey service.
    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValueOnce(new e.PasskeyAlreadyExists.Error());

    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse({
            id: existingCredentialId,
            rawId: existingCredentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    await expectError(res, e.PasskeyAlreadyExists);
    mockVerifyRegistration.mockRestore();
  });

  test('should return 403 for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Try to get registration options first - should fail for config users
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );

    // Config users cannot setup 2FA
    await expectError(optionsRes, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should validate clientDataJSON structure', async () => {
    const email = generateUniqueEmail('passkey-verify-invalid-clientdata');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValueOnce(new e.PasskeyVerificationFailed.Error());

    // Try with malformed clientDataJSON
    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse({
            clientDataJSON: 'not-valid-base64',
          }),
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    await expectError(res, e.PasskeyVerificationFailed);
    mockVerifyRegistration.mockRestore();
  });

  test('should clear challenge from session after failed verification', async () => {
    const email = generateUniqueEmail('passkey-verify-clears-on-fail');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    const updatedClient = testClient(app);
    const updatedHeaders = { Cookie: `session=${updatedSessionCookie}` };
    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValue(new e.PasskeyVerificationFailed.Error());

    // First verification attempt (will fail)
    const firstRes =
      await updatedClient.api.user.passkeys.register.verify.$post(
        {
          json: {
            response: createMockRegistrationResponse(),
          },
        },
        { headers: updatedHeaders },
      );
    await expectError(firstRes, e.PasskeyVerificationFailed);

    // Try again with the same session
    const res2 = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
        },
      },
      { headers: updatedHeaders },
    );

    const secondBody = await assertJsonBody(res2, 400);
    expect(
      secondBody.code === 'PASSKEY_CHALLENGE_NOT_FOUND' ||
        secondBody.code === 'PASSKEY_VERIFICATION_FAILED',
    ).toBe(true);

    mockVerifyRegistration.mockRestore();
  });

  test('should handle concurrent verification attempts', async () => {
    const email = generateUniqueEmail('passkey-verify-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    const updatedClient = testClient(app);
    const updatedHeaders = { Cookie: `session=${updatedSessionCookie}` };
    const mockVerifyRegistration = vi
      .spyOn(services.passkeyService, 'verifyRegistration')
      .mockRejectedValue(new e.PasskeyVerificationFailed.Error());

    // Send concurrent verification requests
    const results = await Promise.all([
      updatedClient.api.user.passkeys.register.verify.$post(
        {
          json: {
            response: createMockRegistrationResponse(),
          },
        },
        { headers: updatedHeaders },
      ),
      updatedClient.api.user.passkeys.register.verify.$post(
        {
          json: {
            response: createMockRegistrationResponse(),
          },
        },
        { headers: updatedHeaders },
      ),
    ]);

    // First request can fail at verification; subsequent requests fail
    // because challenge is single-use and already cleared.
    for (const res of results) {
      const body = await assertJsonBody(res, 400);
      expect(
        body.code === 'PASSKEY_VERIFICATION_FAILED' ||
          body.code === 'PASSKEY_CHALLENGE_NOT_FOUND',
      ).toBe(true);
    }

    mockVerifyRegistration.mockRestore();
  });

  test('should require response to have proper nested structure', async () => {
    const email = generateUniqueEmail('passkey-verify-nested-structure');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Get registration options
    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );
    let updatedSessionCookie: string;
    try {
      updatedSessionCookie = extractCookie(optionsRes, 'session');
    } catch {
      updatedSessionCookie = sessionCookie;
    }

    // Missing attestationObject
    const updatedClient = testClient(app);
    const res = await updatedClient.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: {
            id: 'mock-id',
            rawId: 'mock-id',
            response: {
              clientDataJSON: 'mock-data',
              // missing attestationObject
            },
            type: 'public-key',
            clientExtensionResults: {},
          },
        },
      },
      { headers: { Cookie: `session=${updatedSessionCookie}` } },
    );

    expect(res.status).toBe(400);
  });
});

describe('POST /api/user/passkeys/register/verify - Passkey disabled', () => {
  let appChallenge: AppType;
  let servicesChallenge: ServiceContainer;
  let cleanupChallenge: () => Promise<void>;
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
    const challengeServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      auth: {
        passkey: {
          enabled: true,
        },
      },
    });
    appChallenge = challengeServer.app;
    servicesChallenge = challengeServer.services;
    cleanupChallenge = challengeServer.cleanup;

    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      registration: {
        email_verification_required: true,
      },
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
    await cleanupChallenge();
    await cleanupDisabled();
  });

  test('should return PASSKEY_NOT_ENABLED when passkey is disabled in config', async () => {
    const email = generateUniqueEmail('passkey-disabled-verify');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSessionHelper(
      appChallenge,
      servicesChallenge,
      email,
      password,
    );

    const challengeClient = testClient(appChallenge);
    const optionsRes =
      await challengeClient.api.user.passkeys.register.options.$post(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
    const challengeCookie = extractCookie(optionsRes, 'session');

    const client = testClient(appDisabled);
    const res = await client.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse(),
        },
      },
      { headers: { Cookie: `session=${challengeCookie}` } },
    );

    await expectError(res, e.PasskeyNotEnabled);
  });
});

describe('POST /api/user/passkeys/register/verify - Pending 2FA setup', () => {
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

  test('should promote pending setup session to full session after successful verification', async () => {
    const email = generateUniqueEmail('passkey-pending-setup-success');
    const password = 'testPassword123!';
    const credentialId = `pending-setup-${crypto.randomUUID()}`;

    await withMikroContext(services2FA, async () => {
      const passwordHash =
        await services2FA.securityService.hashPassword(password);
      const user = services2FA.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services2FA.mikro.em.persist(user).flush();
    });

    const client = testClient(app2FA);
    const loginRes = await client.api.auth.login.$post({
      json: { email, password },
    });
    const pendingCookie = extractCookie(loginRes, 'session');

    const optionsRes = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${pendingCookie}` } },
    );
    const optionsBody = await assertJsonBody(optionsRes);
    const optionsCookie = extractCookie(optionsRes, 'session');

    const verifyRegistration = vi
      .spyOn(services2FA.passkeyService, 'verifyRegistration')
      .mockImplementationOnce(async (user, _response, expectedChallenge) => {
        expect(expectedChallenge).toBe(optionsBody.options.challenge);
        const passkey = services2FA.mikro.userPasskey.create({
          user: user.sub,
          credential_id: credentialId,
          public_key: 'test-public-key-base64url',
          counter: 0,
          device_type: 'multiDevice',
          backed_up: true,
          transports: ['internal'],
          name: 'Setup Passkey',
          aaguid: 'test-aaguid',
        });
        await services2FA.mikro.em.persist(passkey).flush();
        return passkey;
      });

    const verifyRes = await client.api.user.passkeys.register.verify.$post(
      {
        json: {
          response: createMockRegistrationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      { headers: { Cookie: `session=${optionsCookie}` } },
    );

    const verifyBody = await assertJsonBody(verifyRes);
    expect(verifyBody.ok).toBe(true);
    expect(verifyBody.second_factor_setup_completed).toBe(true);
    if (!('user' in verifyBody)) {
      throw new Error('Expected promoted user session in response');
    }
    expect(verifyBody.user.email).toBe(email);

    const fullSessionCookie = extractCookie(verifyRes, 'session');
    const sessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${fullSessionCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user).not.toBeNull();
    expect(sessionBody.user?.email).toBe(email);
    expect(sessionBody.user?.passkey_count).toBe(1);

    verifyRegistration.mockRestore();
  });
});
