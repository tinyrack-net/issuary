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

    // Verify authentication_methods structure
    expect(json.authentication_methods).toBeDefined();
    expect(typeof json.authentication_methods).toBe('object');
  });

  test('should include password authentication method', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Check password auth method exists
    expect(json.authentication_methods.password).toBeDefined();
    expect(json.authentication_methods.password.enabled).toBeTypeOf('boolean');
    expect(json.authentication_methods.password.type).toBe('password');
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
