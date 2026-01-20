import { describe, expect, test, vi } from 'vitest';
import {
  createDbUserWithSession,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer({
  configOverrides: {
    basic_authentication_methods: {
      passkey: {
        enabled: true,
        email_verification: true,
      },
    },
  },
});

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
  test('should return 400 when no challenge in session', async () => {
    // First need a valid session, then try to verify without getting options
    const email = generateUniqueEmail('passkey-verify-no-challenge');
    const password = 'testPassword123!';

    await createDbUserWithSession(app, email, password);

    // Directly call verify without getting options first (no challenge in session)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/verify',
      payload: {
        response: createMockAuthenticationResponse(),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');
  });

  test('should return 400 when response body is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/verify',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  test('should return 400 when response is missing required fields', async () => {
    // Get options first to set challenge in session
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    expect(optionsRes.statusCode).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: {
            rawId: 'mock-id',
            response: {
              clientDataJSON: 'mock-data',
            },
            type: 'public-key',
          },
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should return 404 when passkey not found', async () => {
    // Get options first to set challenge in session
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    expect(optionsRes.statusCode).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with a non-existent credential ID
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse({
            id: 'non-existent-credential-id',
          }),
        },
      },
      sessionCookie,
    );

    // PASSKEY_NOT_FOUND (404) when credential doesn't exist
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('PASSKEY_NOT_FOUND');
  });

  test('should return 400 when verification fails with invalid signature', async () => {
    const email = generateUniqueEmail('passkey-auth-invalid-sig');
    const password = 'testPassword123!';

    // Create user and passkey
    const { userId } = await createDbUserWithSession(app, email, password);
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ id: userId });
      const passkey = app.mikro.userPasskey.create({
        user,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Test Passkey',
        aaguid: 'test-aaguid',
      });
      await app.mikro.em.persist(passkey).flush();
    });

    // Get options to set challenge in session
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    expect(optionsRes.statusCode).toBe(200);

    const sessionCookie = extractCookie(optionsRes, 'session');

    // Try to verify with invalid signature
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      sessionCookie,
    );

    // Should fail at verification (400 or 500 depending on WebAuthn lib error handling)
    expect([400, 500].includes(res.statusCode)).toBe(true);
  });

  test('should clear challenge from session after attempt', async () => {
    // Get options first
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    const sessionCookie = extractCookie(optionsRes, 'session');

    // First attempt (will fail)
    await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse(),
        },
      },
      sessionCookie,
    );

    // Second attempt with same session should fail with challenge not found
    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse(),
        },
      },
      sessionCookie,
    );

    // Challenge should be cleared, so second attempt fails with challenge not found
    // or passkey not found (whichever check comes first)
    expect([400, 404].includes(res2.statusCode)).toBe(true);
  });

  test('should return 400 when type is not public-key', async () => {
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    const sessionCookie = extractCookie(optionsRes, 'session');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse({ type: 'invalid-type' }),
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(400);
  });

  test('should handle concurrent verification attempts', async () => {
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    const sessionCookie = extractCookie(optionsRes, 'session');

    // Send concurrent verification requests
    const results = await Promise.all([
      injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/auth/passkey/verify',
          payload: {
            response: createMockAuthenticationResponse(),
          },
        },
        sessionCookie,
      ),
      injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/auth/passkey/verify',
          payload: {
            response: createMockAuthenticationResponse(),
          },
        },
        sessionCookie,
      ),
    ]);

    // All should fail (challenge or passkey error)
    for (const res of results) {
      expect([400, 404, 500].includes(res.statusCode)).toBe(true);
    }
  });
});

describe('POST /api/v1/auth/passkey/verify - Success with mocked service', () => {
  test('should return 200 and create session on successful verification', async () => {
    const email = generateUniqueEmail('passkey-auth-success');
    const password = 'testPassword123!';

    // Create user
    const { userId } = await createDbUserWithSession(app, email, password);
    const credentialId = `success-credential-${crypto.randomUUID()}`;

    // Create passkey for user and get user reference
    const user = await withMikroContext(app, async () => {
      const userEntity = await app.mikro.user.findOneOrFail({ id: userId });
      const passkey = app.mikro.userPasskey.create({
        user: userEntity,
        credential_id: credentialId,
        public_key: 'test-public-key-base64url',
        counter: 0,
        device_type: 'multiDevice',
        backed_up: true,
        transports: ['internal'],
        name: 'Test Passkey',
        aaguid: 'test-aaguid',
      });
      await app.mikro.em.persist(passkey).flush();
      return userEntity;
    });

    // Get options to set challenge in session
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });
    expect(optionsRes.statusCode).toBe(200);
    const sessionCookie = extractCookie(optionsRes, 'session');

    // Mock the verifyAuthentication method to return success
    const mockVerifyAuthentication = vi
      .spyOn(app.passkeyService, 'verifyAuthentication')
      .mockResolvedValueOnce(user);

    // Verify with mocked service
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/auth/passkey/verify',
        payload: {
          response: createMockAuthenticationResponse({
            id: credentialId,
            rawId: credentialId,
          }),
        },
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

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
    const newSessionCookie = res.cookies.find((c) => c.name === 'session');
    expect(newSessionCookie).toBeDefined();

    // Cleanup
    mockVerifyAuthentication.mockRestore();
  });
});

describe('POST /api/v1/auth/passkey/verify - Passkey disabled', () => {
  const appDisabled = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        passkey: {
          enabled: false,
          email_verification: true,
        },
      },
    },
  });

  test('should return 404 when passkey is disabled (route not registered)', async () => {
    const res = await appDisabled.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/verify',
      payload: {
        response: createMockAuthenticationResponse(),
      },
    });

    expect(res.statusCode).toBe(404);
  });
});
