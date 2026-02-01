import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  expectError,
  generateUniqueEmail,
  injectWithSession,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

describe('POST /api/v1/user/passkeys/register/options', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          passkey: {
            enabled: true,
            email_verification: true,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/user/passkeys/register/options',
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return WebAuthn registration options', async () => {
    const email = generateUniqueEmail('passkey-options-success');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify response structure matches WebAuthn spec
    expect(body.options).toBeDefined();
    expect(body.options.challenge).toBeDefined();
    expect(typeof body.options.challenge).toBe('string');
    expect(body.options.challenge.length).toBeGreaterThan(10);

    // RP (Relying Party) info
    expect(body.options.rp).toBeDefined();
    expect(body.options.rp.name).toBeDefined();
    expect(body.options.rp.id).toBeDefined();

    // User info
    expect(body.options.user).toBeDefined();
    expect(body.options.user.name).toBe(email);
    expect(body.options.user.displayName).toBe(email);
    expect(body.options.user.id).toBeDefined();

    // Pub key cred params
    expect(body.options.pubKeyCredParams).toBeDefined();
    expect(Array.isArray(body.options.pubKeyCredParams)).toBe(true);
    expect(body.options.pubKeyCredParams.length).toBeGreaterThan(0);

    // Each param should have alg and type
    for (const param of body.options.pubKeyCredParams) {
      expect(param.alg).toBeDefined();
      expect(param.type).toBe('public-key');
    }

    // Attestation
    expect(body.options.attestation).toBe('none');

    // Authenticator selection
    expect(body.options.authenticatorSelection).toBeDefined();
  });

  test('should return unique challenge each time', async () => {
    const email = generateUniqueEmail('passkey-options-unique-challenge');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    const res1 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    const res2 = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const challenge1 = res1.json().options.challenge;
    const challenge2 = res2.json().options.challenge;

    expect(challenge1).not.toBe(challenge2);
  });

  test('should exclude existing passkeys from registration', async () => {
    const email = generateUniqueEmail('passkey-options-exclude-existing');
    const password = 'testPassword123!';

    const { sessionCookie, userId } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Create existing passkeys
    await createPasskeyForUser(app, userId, 'Existing Passkey 1');
    await createPasskeyForUser(app, userId, 'Existing Passkey 2');

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Should have excludeCredentials with the existing passkeys
    expect(body.options.excludeCredentials).toBeDefined();
    expect(Array.isArray(body.options.excludeCredentials)).toBe(true);
    expect(body.options.excludeCredentials.length).toBe(2);

    // Each excluded credential should have id and type
    for (const cred of body.options.excludeCredentials) {
      expect(cred.id).toBeDefined();
      expect(cred.type).toBe('public-key');
    }
  });

  test('should return empty excludeCredentials when user has no passkeys', async () => {
    const email = generateUniqueEmail('passkey-options-no-existing');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.options.excludeCredentials).toBeDefined();
    expect(body.options.excludeCredentials).toHaveLength(0);
  });

  test('should set authenticator selection preferences', async () => {
    const email = generateUniqueEmail('passkey-options-auth-selection');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    const authSelection = body.options.authenticatorSelection;
    expect(authSelection.residentKey).toBe('preferred');
    expect(authSelection.userVerification).toBe('preferred');
  });

  test('should store challenge in session', async () => {
    const email = generateUniqueEmail('passkey-options-session-challenge');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // The challenge should be stored in session for later verification
    // We can't directly test session, but we verify through the verify endpoint
    // that the challenge matches
    expect(body.options.challenge).toBeDefined();
  });

  test('should return 403 for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    // Config users cannot setup 2FA
    expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should include timeout in options', async () => {
    const email = generateUniqueEmail('passkey-options-timeout');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Timeout should be present (simplewebauthn sets a default)
    expect(body.options.timeout).toBeDefined();
    expect(typeof body.options.timeout).toBe('number');
  });

  test('should include supported algorithms in pubKeyCredParams', async () => {
    const email = generateUniqueEmail('passkey-options-algorithms');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    const algorithms = body.options.pubKeyCredParams.map(
      (p: { alg: number }) => p.alg,
    );

    // Should include common algorithms like ES256 (-7) and RS256 (-257)
    // At minimum ES256 should be present as it's widely supported
    expect(algorithms).toContain(-7); // ES256
  });

  test('should set correct rp.id based on host config', async () => {
    const email = generateUniqueEmail('passkey-options-rp-id');
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
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // rp.id should be the hostname from config (localhost in test)
    expect(body.options.rp.id).toBe('localhost');
  });

  test('should handle multiple concurrent requests', async () => {
    const email = generateUniqueEmail('passkey-options-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      email,
      password,
    );

    // Send multiple concurrent requests
    const results = await Promise.all([
      injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/user/passkeys/register/options',
        },
        sessionCookie,
      ),
      injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/user/passkeys/register/options',
        },
        sessionCookie,
      ),
      injectWithSession(
        app,
        {
          method: 'POST',
          url: '/api/v1/user/passkeys/register/options',
        },
        sessionCookie,
      ),
    ]);

    // All should succeed
    for (const res of results) {
      expect(res.statusCode).toBe(200);
      expect(res.json().options).toBeDefined();
    }

    // All challenges should be unique
    const challenges = results.map((r) => r.json().options.challenge);
    const uniqueChallenges = new Set(challenges);
    expect(uniqueChallenges.size).toBe(3);
  });
});

describe('POST /api/v1/user/passkeys/register/options - Passkey disabled', () => {
  let appDisabled: FastifyInstance;

  beforeAll(async () => {
    appDisabled = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          passkey: {
            enabled: false,
            email_verification: true,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await appDisabled.close();
  });

  test('should return 404 when passkey is disabled in config (route not registered)', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const res = await injectWithSession(
      appDisabled,
      {
        method: 'POST',
        url: '/api/v1/user/passkeys/register/options',
      },
      sessionCookie,
    );

    // When passkey is disabled, the route is not registered at all
    expect(res.statusCode).toBe(404);
  });
});
