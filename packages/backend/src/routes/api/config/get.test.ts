import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/app.js';
import { createApp } from '#backend/app.js';
import { MINIMAL_TEST_CONFIG } from '#backend/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createApp({
    config: {
      ...MINIMAL_TEST_CONFIG,
      identity_providers: [
        {
          id: 'google',
          type: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        },
      ],
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /api/config', () => {
  test('should return app configuration', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Verify app config structure
    expect(json.app).toBeDefined();
    expect(json.app.supported_languages).toBeInstanceOf(Array);
    expect(json.app.default_language).toBeTypeOf('string');
    expect(json.app.fallback_language).toBeTypeOf('string');
    expect(json.app.theme_mode).toBeTypeOf('string');

    // Verify database config structure
    expect(json.database).toBeDefined();
    expect(json.database.enabled).toBeTypeOf('boolean');

    // Verify auth structure
    expect(json.auth).toBeDefined();
    expect(typeof json.auth).toBe('object');

    // Verify identity_providers structure (now an array)
    expect(json.identity_providers).toBeDefined();
    expect(Array.isArray(json.identity_providers)).toBe(true);
  });

  test('should include password authentication method in auth', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check password auth method exists
    expect(json.auth.password).toBeDefined();
    expect(json.auth.password.enabled).toBeTypeOf('boolean');

    // Check second_factor configuration
    if (json.auth.password.second_factor) {
      expect(json.auth.password.second_factor.required).toBeTypeOf('boolean');
    }

    // Check TOTP configuration
    if (json.auth.password.totp) {
      expect(json.auth.password.totp.enabled).toBeTypeOf('boolean');
    }
  });

  test('should include passkey authentication method in auth', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check passkey auth method exists
    expect(json.auth.passkey).toBeDefined();
    expect(json.auth.passkey.enabled).toBeTypeOf('boolean');
    expect(json.auth.passkey.email_verification).toBeTypeOf('boolean');
  });

  test('should include smtp enabled flag', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.smtp.enabled).toBeTypeOf('boolean');
    expect(json.smtp.enabled).toBe(true);
  });

  test('should include identity providers', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check identity providers - should be an array of only enabled providers
    expect(Array.isArray(json.identity_providers)).toBe(true);

    // Find Google provider in the array (should be enabled in test config)
    const googleProvider = json.identity_providers.find(
      (m) => m.id === 'google',
    );
    if (googleProvider) {
      expect(googleProvider.type).toBe('google');
      expect(googleProvider.display_name).toBeTypeOf('string');
      // enabled field should not exist (only enabled providers are returned)
      expect('enabled' in googleProvider).toBe(false);
    }
  });

  test('should not require authentication', async () => {
    const client = testClient(app);
    // This endpoint should be publicly accessible
    const res = await client.api.config.$get();

    // Should not return 401
    expect(res.status).toBe(200);
  });
});

describe('GET /api/config (smtp disabled)', () => {
  let appNoSmtp: AppType;
  let cleanupNoSmtp: () => Promise<void>;

  beforeAll(async () => {
    const { smtp: _smtp, ...configWithoutSmtp } = MINIMAL_TEST_CONFIG;
    void _smtp;
    const server = await createApp({
      config: {
        ...configWithoutSmtp,
      },
    });
    appNoSmtp = server.app;
    cleanupNoSmtp = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoSmtp();
  });

  test('should expose smtp.enabled=false when smtp is not configured', async () => {
    const client = testClient(appNoSmtp);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.smtp.enabled).toBe(false);
  });
});
