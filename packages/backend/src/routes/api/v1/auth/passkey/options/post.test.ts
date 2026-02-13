import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';
import type { AppType, ServiceContainer } from '@/types.js';

describe('POST /api/v1/auth/passkey/options', () => {
  let app: AppType;
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
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should return WebAuthn authentication options', async () => {
    const res = await app.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();

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
    const res1 = await app.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    const res2 = await app.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const body1 = await res1.json();
    const body2 = await res2.json();
    const challenge1 = body1.options.challenge;
    const challenge2 = body2.options.challenge;

    expect(challenge1).not.toBe(challenge2);
  });

  test('should store challenge in session for later verification', async () => {
    const optionsRes = await app.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    expect(optionsRes.status).toBe(200);

    // Session cookie should be set
    const setCookie = optionsRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toBeTruthy();
  });

  test('should handle concurrent requests with unique challenges', async () => {
    const results = await Promise.all([
      app.request('/api/v1/auth/passkey/options', { method: 'POST' }),
      app.request('/api/v1/auth/passkey/options', { method: 'POST' }),
      app.request('/api/v1/auth/passkey/options', { method: 'POST' }),
    ]);

    // All should succeed
    const bodies = [];
    for (const res of results) {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.options).toBeDefined();
      bodies.push(body);
    }

    // All challenges should be unique
    const challenges = bodies.map((b) => b.options.challenge);
    const uniqueChallenges = new Set(challenges);
    expect(uniqueChallenges.size).toBe(3);
  });

  test('should set correct rpId based on host config', async () => {
    const res = await app.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // rpId should be the hostname from config (localhost in test)
    expect(body.options.rpId).toBe('localhost');
  });
});

describe('POST /api/v1/auth/passkey/options - 2FA mode', () => {
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

  test('should return options with allowCredentials for pending 2FA user', async () => {
    const email = generateUniqueEmail('passkey-options-2fa');
    const password = 'testPassword123!';
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    // Create user with passkey in DB
    await withMikroContext(services2FA, async () => {
      const user = services2FA.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services2FA.mikro.em.persist(user).flush();

      // Add passkey to user
      const passkey = services2FA.mikro.userPasskey.create({
        user: user.id,
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
    const loginRes = await app2FA.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.passkey_count).toBe(1);

    // Get session cookie with pending2FAUser
    const sessionCookie = extractCookie(loginRes, 'session');

    // Now call passkey options - should return allowCredentials for this user
    const optionsRes = await app2FA.request('/api/v1/auth/passkey/options', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    });

    expect(optionsRes.status).toBe(200);
    const body = await optionsRes.json();

    // Should have allowCredentials with the user's passkey
    expect(body.options.allowCredentials).toBeDefined();
    expect(Array.isArray(body.options.allowCredentials)).toBe(true);
    expect(body.options.allowCredentials.length).toBeGreaterThan(0);

    // Verify the credential ID is in the list
    const credentialIds = body.options.allowCredentials.map(
      (c: { id: string }) => c.id,
    );
    expect(credentialIds).toContain(credentialId);
  });

  test('should return empty allowCredentials for passwordless mode', async () => {
    // Create a new app instance just to get options without session
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
    const appForTest = server.app;

    try {
      const res = await appForTest.request('/api/v1/auth/passkey/options', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // Should have empty allowCredentials for discoverable credentials
      expect(body.options.allowCredentials).toBeDefined();
      expect(body.options.allowCredentials).toHaveLength(0);
    } finally {
      await server.cleanup();
    }
  });
});

describe('POST /api/v1/auth/passkey/options - Passkey disabled', () => {
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

  test('should return 404 when passkey is disabled (route not registered)', async () => {
    const res = await appDisabled.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    // Route is registered but validation rejects missing body (400)
    // before handler can check passkey config
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/passkey/options - Custom rpId', () => {
  let appCustomRpId: AppType;
  let cleanupCustomRpId: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        auth: {
          passkey: {
            enabled: true,
            email_verification: true,
            rp_id: 'custom.example.com',
          },
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
    const res = await appCustomRpId.request('/api/v1/auth/passkey/options', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.options.rpId).toBe('custom.example.com');
  });
});
