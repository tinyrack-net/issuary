import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/oauth/providers', () => {
  test('should return list of enabled OAuth providers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oauth/providers',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    expect(json.providers).toBeDefined();
    expect(json.providers).toBeInstanceOf(Array);
  });

  test('should return provider details with correct structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oauth/providers',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // If there are providers, check their structure
    if (json.providers.length > 0) {
      const provider = json.providers[0];
      expect(provider.name).toBeTypeOf('string');
      expect(provider.display_name).toBeTypeOf('string');
      // icon_url is optional
      if (provider.icon_url !== undefined) {
        expect(provider.icon_url).toBeTypeOf('string');
      }
    }
  });

  test('should not require authentication', async () => {
    // This endpoint should be publicly accessible
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oauth/providers',
    });

    // Should not return 401
    expect(res.statusCode).toBe(200);
  });

  test('should include google provider when enabled in config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oauth/providers',
    });

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // In test config, google should be enabled
    const googleProvider = json.providers.find(
      (p: { name: string }) => p.name === 'google',
    );
    expect(googleProvider).toBeDefined();
    expect(googleProvider.display_name).toBe('Google');
  });
});
