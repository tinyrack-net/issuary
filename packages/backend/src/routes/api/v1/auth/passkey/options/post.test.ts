import { describe, expect, test } from 'vitest';
import {
  extractCookie,
  generateUniqueEmail,
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

describe('POST /api/v1/auth/passkey/options', () => {
  test('should return WebAuthn authentication options', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

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
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const challenge1 = res1.json().options.challenge;
    const challenge2 = res2.json().options.challenge;

    expect(challenge1).not.toBe(challenge2);
  });

  test('should store challenge in session for later verification', async () => {
    const optionsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(optionsRes.statusCode).toBe(200);

    // Session cookie should be set
    const sessionCookie = optionsRes.cookies.find((c) => c.name === 'session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  test('should handle concurrent requests with unique challenges', async () => {
    const results = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/auth/passkey/options' }),
      app.inject({ method: 'POST', url: '/api/v1/auth/passkey/options' }),
      app.inject({ method: 'POST', url: '/api/v1/auth/passkey/options' }),
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

  test('should set correct rpId based on host config', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // rpId should be the hostname from config (localhost in test)
    expect(body.options.rpId).toBe('localhost');
  });
});

describe('POST /api/v1/auth/passkey/options - 2FA mode', () => {
  // App with 2FA required for testing pending2FAUser session
  const app2FA = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
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

  test('should return options with allowCredentials for pending 2FA user', async () => {
    const email = generateUniqueEmail('passkey-options-2fa');
    const password = 'testPassword123!';
    const credentialId = `test-credential-${crypto.randomUUID()}`;

    // Create user with passkey in DB
    await withMikroContext(app2FA, async () => {
      const user = app2FA.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app2FA.mikro.em.persist(user).flush();

      // Add passkey to user
      const passkey = app2FA.mikro.userPasskey.create({
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
      await app2FA.mikro.em.persist(passkey).flush();
    });

    // Login with password - should get pending2FAUser session (2FA required)
    const loginRes = await app2FA.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json().user.passkey_count).toBe(1);

    // Get session cookie with pending2FAUser
    const sessionCookie = extractCookie(loginRes, 'session');

    // Now call passkey options - should return allowCredentials for this user
    const optionsRes = await app2FA.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
      cookies: { session: sessionCookie },
    });

    expect(optionsRes.statusCode).toBe(200);
    const body = optionsRes.json();

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
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Should have empty allowCredentials for discoverable credentials
    expect(body.options.allowCredentials).toBeDefined();
    expect(body.options.allowCredentials).toHaveLength(0);
  });
});

describe('POST /api/v1/auth/passkey/options - Passkey disabled', () => {
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
      url: '/api/v1/auth/passkey/options',
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/v1/auth/passkey/options - Custom rpId', () => {
  const appCustomRpId = setupTestServer({
    configOverrides: {
      basic_authentication_methods: {
        passkey: {
          enabled: true,
          email_verification: true,
          rp_id: 'custom.example.com',
        },
      },
    },
  });

  test('should use custom rp_id from config', async () => {
    const res = await appCustomRpId.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/options',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.options.rpId).toBe('custom.example.com');
  });
});
