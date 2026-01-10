import { describe, expect, test } from 'vitest';
import { setupTestServer, TEST_OAUTH_CLIENT } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /application/oauth/:provider_id/.well-known/jwks', () => {
  describe('Success Cases', () => {
    test('should return empty JWKS for valid provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/application/oauth/${TEST_OAUTH_CLIENT.clientId}/.well-known/jwks`,
      });

      expect(res.statusCode).toBe(200);

      const json = res.json();
      expect(json).toHaveProperty('keys');
      expect(Array.isArray(json.keys)).toBe(true);
      expect(json.keys).toHaveLength(0);
    });

    test('should return correct content-type header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/application/oauth/${TEST_OAUTH_CLIENT.clientId}/.well-known/jwks`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    test('should return JWKS conforming to RFC 7517 structure', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/application/oauth/${TEST_OAUTH_CLIENT.clientId}/.well-known/jwks`,
      });

      expect(res.statusCode).toBe(200);

      const json = res.json();

      // RFC 7517 §5: JWKS must have "keys" member
      expect(json).toHaveProperty('keys');
      expect(Array.isArray(json.keys)).toBe(true);

      // Currently using HS256, so keys array should be empty
      // When migrating to RS256/ES256, each key should have:
      // - kty (Key Type): required
      // - use (Public Key Use): optional, "sig" for signature
      // - kid (Key ID): optional but recommended
      // - alg (Algorithm): optional but recommended
    });
  });

  describe('Error Cases', () => {
    test('should return 400 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/non-existent-provider/.well-known/jwks',
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 for invalid provider ID format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/invalid-provider-id/.well-known/jwks',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Caching Behavior', () => {
    test('should be idempotent - multiple requests return same result', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: `/application/oauth/${TEST_OAUTH_CLIENT.clientId}/.well-known/jwks`,
      });

      const res2 = await app.inject({
        method: 'GET',
        url: `/application/oauth/${TEST_OAUTH_CLIENT.clientId}/.well-known/jwks`,
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res1.json()).toEqual(res2.json());
    });
  });
});
