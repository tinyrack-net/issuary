import { testClient } from 'hono/testing';
import { decodeProtectedHeader } from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#server/entrypoints/app.js';
import {
  createAuthenticatedSession,
  createTestApp,
  exchangeCodeForTokens,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '#server/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /oauth/.well-known/jwks', () => {
  describe('Success Cases', () => {
    test('should return JWKS with RSA public keys', async () => {
      const client = testClient(app);
      const res = await client.oauth['.well-known'].jwks.$get();

      expect(res.status).toBe(200);

      const json = await res.json();
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
      const client = testClient(app);
      const res = await client.oauth['.well-known'].jwks.$get();

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    test('should return JWKS conforming to RFC 7517 structure', async () => {
      const client = testClient(app);
      const res = await client.oauth['.well-known'].jwks.$get();

      expect(res.status).toBe(200);

      const json = await res.json();

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
      const client = testClient(app);
      const res = await client.oauth['.well-known'].jwks.$get();

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    });

    test('should expose the key id used by issued ID tokens', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const { code } = await getAuthorizationCode(app, { sessionCookie });
      const tokenResponse = await exchangeCodeForTokens(app, {
        code,
        codeVerifier: TEST_PKCE.codeVerifier,
      });
      expect(tokenResponse.status).toBe(200);
      const tokenJson = await tokenResponse.json();
      expect(tokenJson.id_token).toEqual(expect.any(String));
      if (typeof tokenJson.id_token !== 'string') {
        throw new Error('Expected id_token in token response');
      }
      const header = decodeProtectedHeader(tokenJson.id_token);
      expect(header.kid).toEqual(expect.any(String));

      const client = testClient(app);
      const jwksResponse = await client.oauth['.well-known'].jwks.$get();
      expect(jwksResponse.status).toBe(200);
      const jwks = await jwksResponse.json();
      expect(jwks.keys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kid: header.kid,
            use: 'sig',
            alg: 'RS256',
          }),
        ]),
      );
    });
  });

  describe('Caching Behavior', () => {
    test('should be idempotent - multiple requests return same result', async () => {
      const client = testClient(app);

      const res1 = await client.oauth['.well-known'].jwks.$get();
      const res2 = await client.oauth['.well-known'].jwks.$get();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(await res1.json()).toEqual(await res2.json());
    });
  });
});
