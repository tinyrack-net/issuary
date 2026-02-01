import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import { MINIMAL_TEST_CONFIG } from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: MINIMAL_TEST_CONFIG,
  });
});

afterAll(async () => {
  await app.close();
});

describe('GET /application/oauth/.well-known/jwks', () => {
  const url = '/application/oauth/.well-known/jwks';

  describe('Success Cases', () => {
    test('should return JWKS with RSA public keys', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);

      const json = res.json();
      expect(json).toHaveProperty('keys');
      expect(Array.isArray(json.keys)).toBe(true);
      expect(json.keys.length).toBeGreaterThanOrEqual(1);

      // Verify the first key has required JWK properties
      const key = json.keys[0];
      expect(key).toHaveProperty('kty', 'RSA');
      expect(key).toHaveProperty('use', 'sig');
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('alg', 'RS256');
      expect(key).toHaveProperty('n'); // RSA modulus
      expect(key).toHaveProperty('e'); // RSA exponent
    });

    test('should return correct content-type header', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    test('should return JWKS conforming to RFC 7517 structure', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);

      const json = res.json();

      // RFC 7517 §5: JWKS must have "keys" member
      expect(json).toHaveProperty('keys');
      expect(Array.isArray(json.keys)).toBe(true);

      // Each key should have required/recommended properties
      for (const key of json.keys) {
        // kty (Key Type): required
        expect(key).toHaveProperty('kty');
        expect(typeof key.kty).toBe('string');

        // use (Public Key Use): recommended for signature keys
        expect(key).toHaveProperty('use', 'sig');

        // kid (Key ID): recommended for key rotation
        expect(key).toHaveProperty('kid');
        expect(typeof key.kid).toBe('string');

        // alg (Algorithm): recommended
        expect(key).toHaveProperty('alg');
        expect(typeof key.alg).toBe('string');

        // RSA-specific: n (modulus) and e (exponent)
        if (key.kty === 'RSA') {
          expect(key).toHaveProperty('n');
          expect(key).toHaveProperty('e');
        }
      }
    });

    test('should include Cache-Control header', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
    });
  });

  describe('Caching Behavior', () => {
    test('should be idempotent - multiple requests return same result', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url,
      });

      const res2 = await app.inject({
        method: 'GET',
        url,
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res1.json()).toEqual(res2.json());
    });
  });
});
