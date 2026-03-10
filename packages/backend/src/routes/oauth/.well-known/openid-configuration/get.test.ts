import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#backend/test-utils/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    config: MINIMAL_TEST_CONFIG,
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('GET /oauth/.well-known/openid-configuration', () => {
  describe('Required Fields', () => {
    test('should return valid OpenID Configuration', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      // Required fields per OpenID Connect Discovery 1.0
      expect(json.issuer).toBeDefined();
      expect(json.authorization_endpoint).toBeDefined();
      expect(json.token_endpoint).toBeDefined();
      expect(json.jwks_uri).toBeDefined();
      expect(json.response_types_supported).toBeDefined();
      expect(json.subject_types_supported).toBeDefined();
      expect(json.id_token_signing_alg_values_supported).toBeDefined();
    });

    test('should have RS256 as signing algorithm', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.id_token_signing_alg_values_supported).toContain('RS256');
    });

    test('should have correct JWKS URI', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.jwks_uri).toContain('/oauth/jwks');
    });
  });

  describe('Recommended Fields', () => {
    test('should include userinfo endpoint', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.userinfo_endpoint).toBeDefined();
      expect(json.userinfo_endpoint).toContain('/userinfo');
    });

    test('should include supported scopes', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.scopes_supported).toContain('openid');
      expect(json.scopes_supported).toContain('profile');
      expect(json.scopes_supported).toContain('email');
    });

    test('should include supported claims', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.claims_supported).toContain('sub');
      expect(json.claims_supported).toContain('email');
      expect(json.claims_supported).toContain('email_verified');
      expect(json.claims_supported).toContain('name');
    });

    test('should support authorization_code grant type', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.grant_types_supported).toContain('authorization_code');
      expect(json.grant_types_supported).toContain('refresh_token');
    });

    test('should support PKCE code challenge methods', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.code_challenge_methods_supported).toContain('S256');
      expect(json.code_challenge_methods_supported).toContain('plain');
    });

    test('should support client authentication methods', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.token_endpoint_auth_methods_supported).toContain(
        'client_secret_basic',
      );
      expect(json.token_endpoint_auth_methods_supported).toContain(
        'client_secret_post',
      );
    });
  });

  describe('Optional Fields', () => {
    test('should include introspection endpoint', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.introspection_endpoint).toBeDefined();
      expect(json.introspection_endpoint).toContain('/introspect');
    });
  });

  describe('Response Headers', () => {
    test('should have Cache-Control header', async () => {
      const client = testClient(app);
      const res =
        await client.oauth['.well-known']['openid-configuration'].$get();

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBeDefined();
      expect(res.headers.get('cache-control')).toContain('max-age');
    });
  });

  describe('Endpoint URL Validation', () => {
    test('should have valid endpoint URLs that can be fetched', async () => {
      const client = testClient(app);
      const configRes =
        await client.oauth['.well-known']['openid-configuration'].$get();
      expect(configRes.status).toBe(200);
      await configRes.json();

      // JWKS endpoint should be accessible
      const jwksRes = await client.oauth['.well-known'].jwks.$get();

      expect(jwksRes.status).toBe(200);
      const jwks = await jwksRes.json();
      expect(jwks.keys).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
    });
  });
});
