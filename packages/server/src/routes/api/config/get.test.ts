import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import { google } from '../../../entrypoints/identity-providers/google.ts';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.ts';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const email = await createTestEmailConfig();
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    branding: {
      icon_url: 'https://example.com/icon.svg',
      logo_url: 'https://example.com/logo.svg',
      title: { en: 'Custom Issuary', ko: '커스텀 Issuary' },
      subtitle: { en: 'Hello!', ko: '' },
      login_method_description: { en: 'Choose one.', ko: '' },
    },
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
    expect(json.branding).toEqual({
      icon_url: 'https://example.com/icon.svg',
      logo_url: 'https://example.com/logo.svg',
      login_method_description: { en: 'Choose one.', ko: '' },
      subtitle: { en: 'Hello!', ko: '' },
      title: { en: 'Custom Issuary', ko: '커스텀 Issuary' },
    });
    expect(json.registration).toBeDefined();
    expect(json.registration.public_registration).toBeTypeOf('boolean');
    expect(json.registration.public_registration).toBe(true);
    expect(json.registration.email_pattern_filter_enabled).toBe(true);
    expect(json.admin).toEqual({ enabled: true });

    expect(json.database).toBeDefined();
    expect(json.database.enabled).toBeTypeOf('boolean');

    expect(json.auth).toBeDefined();
    expect(typeof json.auth).toBe('object');

    expect(json.identity_providers).toBeDefined();
    expect(Array.isArray(json.identity_providers)).toBe(true);
  });

  test('should include password authentication method in auth', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json.auth.password).toBeDefined();
    expect(json.auth.password.enabled).toBeTypeOf('boolean');
    expect(json.auth.password.policy).toEqual({
      min_length: 8,
      max_length: 64,
    });

    if (json.auth.password.two_factor) {
      expect(json.auth.password.two_factor.enrollment_required).toBeTypeOf(
        'boolean',
      );
    }

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

  test('should include identity providers without internal fields', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(Array.isArray(json.identity_providers)).toBe(true);

    let googleProvider: (typeof json.identity_providers)[number] | undefined;
    for (const provider of json.identity_providers) {
      if (provider.id === 'google') {
        googleProvider = provider;
        break;
      }
    }
    expect(googleProvider).toBeDefined();
    if (googleProvider) {
      expect(googleProvider.type).toBe('google');
      expect(googleProvider.display_name).toBeTypeOf('string');
      expect('enabled' in googleProvider).toBe(false);
      expect('client_secret' in googleProvider).toBe(false);
      expect('email_conflict_strategy' in googleProvider).toBe(false);
    }
  });

  test('should not require authentication', async () => {
    const client = testClient(app);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);
  });
});

describe('GET /api/config (email and admin disabled)', () => {
  let appNoEmail: AppType;
  let cleanupNoEmail: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: false },
    });
    appNoEmail = server.app;
    cleanupNoEmail = server.cleanup;
  });

  afterAll(async () => {
    await cleanupNoEmail();
  });

  test('should expose disabled public flags when features are not configured', async () => {
    const client = testClient(appNoEmail);
    const res = await client.api.config.$get();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.email.enabled).toBe(false);
    expect(json.registration.public_registration).toBe(false);
    expect(json.registration.email_pattern_filter_enabled).toBe(false);
    expect(json.admin).toEqual({ enabled: false });
    expect(json).not.toHaveProperty('security');
  });
});
