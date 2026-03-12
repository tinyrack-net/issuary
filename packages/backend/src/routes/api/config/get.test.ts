import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { google } from '#backend/entrypoints/identity-providers/google.js';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '#backend/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const email = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    email,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*@example.com'],
    },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
    auth: {
      password: {
        policy: {
          min_length: 8,
          max_length: 64,
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

describe('GET /api/config', () => {
  test('should return app configuration', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.i18n).toBeDefined();
    expect(json.i18n.supported_languages).toBeInstanceOf(Array);
    expect(json.i18n.default_language).toBeTypeOf('string');
    expect(json.i18n.fallback_language).toBeTypeOf('string');
    expect(json.branding).toBeDefined();
    expect(json.branding.theme_mode).toBeTypeOf('string');
    expect(json.registration).toBeDefined();
    expect(json.registration.public_registration).toBeTypeOf('boolean');
    expect(json.registration.public_registration).toBe(true);
    expect(json.registration.email_pattern_filter_enabled).toBe(true);

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
    expect(json.auth.password.policy).toEqual({
      min_length: 8,
      max_length: 64,
    });

    // Check two_factor configuration
    if (json.auth.password.two_factor) {
      expect(json.auth.password.two_factor.enrollment_required).toBeTypeOf(
        'boolean',
      );
    }

    // Check TOTP configuration
    if (json.auth.password.totp) {
      expect(json.auth.password.totp.enabled).toBeTypeOf('boolean');
    }

    expect(json).not.toHaveProperty('security');
  });

  test('should include passkey authentication method in auth', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check passkey auth method exists
    expect(json.auth.passkey).toBeDefined();
    expect(json.auth.passkey.enabled).toBeTypeOf('boolean');
  });

  test('should include email enabled flag', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.email.enabled).toBeTypeOf('boolean');
    expect(json.email.enabled).toBe(true);
  });

  test('should expose registration filter metadata', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.registration.public_registration).toBe(true);
    expect(json.registration.email_pattern_filter_enabled).toBe(true);
  });

  test('should include identity providers', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check identity providers - should be an array of only enabled providers
    expect(Array.isArray(json.identity_providers)).toBe(true);

    // Find Google provider in the array (should be enabled in test config)
    let googleProvider: (typeof json.identity_providers)[number] | undefined;
    for (const provider of json.identity_providers) {
      if (provider.id === 'google') {
        googleProvider = provider;
        break;
      }
    }
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

describe('GET /api/config (email disabled)', () => {
  let appNoEmail: AppType;
  let cleanupNoEmail: () => Promise<void>;

  beforeAll(async () => {
    const configWithoutEmail = MINIMAL_TEST_CONFIG;
    const server = await createTestApp({
      ...configWithoutEmail,
    });
    appNoEmail = server.app;
    cleanupNoEmail = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoEmail();
  });

  test('should expose email.enabled=false when email is not configured', async () => {
    const client = testClient(appNoEmail);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.email.enabled).toBe(false);
    expect(json.registration.public_registration).toBe(false);
    expect(json.registration.email_pattern_filter_enabled).toBe(false);
  });
});
