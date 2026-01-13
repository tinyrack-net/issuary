import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/config', () => {
  test('should return app configuration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Verify app config structure
    expect(json.app).toBeDefined();
    expect(json.app.supported_languages).toBeInstanceOf(Array);
    expect(json.app.default_language).toBeTypeOf('string');
    expect(json.app.fallback_language).toBeTypeOf('string');
    expect(json.app.theme_mode).toBeTypeOf('string');

    // Verify database config structure
    expect(json.database).toBeDefined();
    expect(json.database.enabled).toBeTypeOf('boolean');

    // Verify basic_authentication_methods structure
    expect(json.basic_authentication_methods).toBeDefined();
    expect(typeof json.basic_authentication_methods).toBe('object');

    // Verify oauth_authentication_methods structure (now an array)
    expect(json.oauth_authentication_methods).toBeDefined();
    expect(Array.isArray(json.oauth_authentication_methods)).toBe(true);
  });

  test('should include password authentication method in basic_authentication_methods', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Check password auth method exists
    expect(json.basic_authentication_methods.password).toBeDefined();
    expect(json.basic_authentication_methods.password.enabled).toBeTypeOf(
      'boolean',
    );

    // Check TOTP configuration
    if (json.basic_authentication_methods.password.totp) {
      expect(
        json.basic_authentication_methods.password.totp.enabled,
      ).toBeTypeOf('boolean');
      expect(
        json.basic_authentication_methods.password.totp.required,
      ).toBeTypeOf('boolean');
    }
  });

  test('should include passkey authentication method in basic_authentication_methods', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Check passkey auth method exists
    expect(json.basic_authentication_methods.passkey).toBeDefined();
    expect(json.basic_authentication_methods.passkey.enabled).toBeTypeOf(
      'boolean',
    );
    expect(
      json.basic_authentication_methods.passkey.email_verification,
    ).toBeTypeOf('boolean');
  });

  test('should include oauth authentication methods', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Check oauth methods - should be an array
    expect(Array.isArray(json.oauth_authentication_methods)).toBe(true);

    // Find Google provider in the array (should be enabled in test config)
    const googleProvider = json.oauth_authentication_methods.find(
      (m: { id: string }) => m.id === 'google',
    );
    if (googleProvider) {
      expect(googleProvider.type).toBe('google');
      expect(googleProvider.enabled).toBeTypeOf('boolean');
    }
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    // Should not return 401
    expect(res.statusCode).toBe(200);
  });
});
