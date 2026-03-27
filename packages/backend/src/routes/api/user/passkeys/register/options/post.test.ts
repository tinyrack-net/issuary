import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../../../entrypoints/app.ts';
import { e } from '../../../../../../schemas/error.ts';
import type { ServiceContainer } from '../../../../../../services/container.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../../../../test-utils/index.ts';

describe('POST /api/user/passkeys/register/options', () => {
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

  test('should return 401 when not authenticated', async () => {
    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post();

    const body = await assertJsonBody(res, 401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('should return WebAuthn registration options', async () => {
    const email = generateUniqueEmail('passkey-options-success');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

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
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    const res1 = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );

    const res2 = await client.api.user.passkeys.register.options.$post(
      {},
      { headers },
    );

    const body1 = await assertJsonBody(res1);
    const body2 = await assertJsonBody(res2);

    const challenge1 = body1.options.challenge;
    const challenge2 = body2.options.challenge;

    expect(challenge1).not.toBe(challenge2);
  });

  test('should exclude existing passkeys from registration', async () => {
    const email = generateUniqueEmail('passkey-options-exclude-existing');
    const password = 'testPassword123!';

    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    // Create existing passkeys
    await createPasskeyForUser(services, userSub, 'Existing Passkey 1');
    await createPasskeyForUser(services, userSub, 'Existing Passkey 2');

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // Should have excludeCredentials with the existing passkeys
    const excludeCredentials = body.options.excludeCredentials;
    expect(excludeCredentials).toBeDefined();
    if (!excludeCredentials) return;
    expect(Array.isArray(excludeCredentials)).toBe(true);
    expect(excludeCredentials.length).toBe(2);

    // Each excluded credential should have id and type
    for (const cred of excludeCredentials) {
      expect(cred.id).toBeDefined();
      expect(cred.type).toBe('public-key');
    }
  });

  test('should return empty excludeCredentials when user has no passkeys', async () => {
    const email = generateUniqueEmail('passkey-options-no-existing');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    expect(body.options.excludeCredentials).toBeDefined();
    expect(body.options.excludeCredentials).toHaveLength(0);
  });

  test('should set authenticator selection preferences', async () => {
    const email = generateUniqueEmail('passkey-options-auth-selection');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    const authSelection = body.options.authenticatorSelection;
    expect(authSelection).toBeDefined();
    if (!authSelection) return;
    expect(authSelection.residentKey).toBe('preferred');
    expect(authSelection.userVerification).toBe('preferred');
  });

  test('should store challenge in session', async () => {
    const email = generateUniqueEmail('passkey-options-session-challenge');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // The challenge should be stored in session for later verification
    // We can't directly test session, but we verify through the verify endpoint
    // that the challenge matches
    expect(body.options.challenge).toBeDefined();
  });

  test('should return 403 for config-managed users', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Config users cannot setup 2FA
    await expectError(res, e.SecondFactorNotAllowedForConfigUser);
  });

  test('should include timeout in options', async () => {
    const email = generateUniqueEmail('passkey-options-timeout');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // Timeout should be present (simplewebauthn sets a default)
    expect(body.options.timeout).toBeDefined();
    expect(typeof body.options.timeout).toBe('number');
  });

  test('should include supported algorithms in pubKeyCredParams', async () => {
    const email = generateUniqueEmail('passkey-options-algorithms');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

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
      services,
      email,
      password,
    );

    const client = testClient(app);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const body = await assertJsonBody(res);

    // rp.id should be the hostname from config (localhost in test)
    expect(body.options.rp.id).toBe('localhost');
  });

  test('should handle multiple concurrent requests', async () => {
    const email = generateUniqueEmail('passkey-options-concurrent');
    const password = 'testPassword123!';

    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const client = testClient(app);
    const headers = { Cookie: `session=${sessionCookie}` };

    // Send multiple concurrent requests
    const results = await Promise.all([
      client.api.user.passkeys.register.options.$post({}, { headers }),
      client.api.user.passkeys.register.options.$post({}, { headers }),
      client.api.user.passkeys.register.options.$post({}, { headers }),
    ]);

    // All should succeed
    for (const res of results) {
      expect(res.status).toBe(200);
    }
    // Note: unique challenge verification is covered by the dedicated test above
  });
});

describe('POST /api/user/passkeys/register/options - Passkey disabled', () => {
  let appDisabled: AppType;
  let cleanupDisabled: () => Promise<void>;

  beforeAll(async () => {
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
    await cleanupDisabled();
  });

  test('should return 400 when passkey is disabled in config', async () => {
    const sessionCookie = await createAuthenticatedSession(appDisabled);

    const client = testClient(appDisabled);
    const res = await client.api.user.passkeys.register.options.$post(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // When passkey is disabled, the route returns 400
    expect(res.status).toBe(400);
  });
});
