import { describe, expect, test } from 'vitest';
import { setupTestServer, TEST_OAUTH_CLIENT } from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /.well-known/openid-configuration', () => {
  const providerId = TEST_OAUTH_CLIENT.clientId;
  const url = `/application/oauth/${providerId}/.well-known/openid-configuration`;

  describe('Required Fields', () => {
    test('should return valid OpenID Configuration', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

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
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.id_token_signing_alg_values_supported).toContain('RS256');
    });

    test('should have correct JWKS URI', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.jwks_uri).toContain(`/${providerId}/.well-known/jwks`);
    });
  });

  describe('Recommended Fields', () => {
    test('should include userinfo endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.userinfo_endpoint).toBeDefined();
      expect(json.userinfo_endpoint).toContain('/userinfo');
    });

    test('should include supported scopes', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.scopes_supported).toContain('openid');
      expect(json.scopes_supported).toContain('profile');
      expect(json.scopes_supported).toContain('email');
    });

    test('should include supported claims', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.claims_supported).toContain('sub');
      expect(json.claims_supported).toContain('email');
      expect(json.claims_supported).toContain('email_verified');
      expect(json.claims_supported).toContain('name');
    });

    test('should support authorization_code grant type', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.grant_types_supported).toContain('authorization_code');
      expect(json.grant_types_supported).toContain('refresh_token');
    });

    test('should support PKCE code challenge methods', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.code_challenge_methods_supported).toContain('S256');
      expect(json.code_challenge_methods_supported).toContain('plain');
    });

    test('should support client authentication methods', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

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
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      expect(json.introspection_endpoint).toBeDefined();
      expect(json.introspection_endpoint).toContain('/introspect');
    });
  });

  describe('Response Headers', () => {
    test('should have Cache-Control header', async () => {
      const res = await app.inject({
        method: 'GET',
        url,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['cache-control']).toContain('max-age');
    });
  });

  describe('Error Cases', () => {
    test('should return 400 for invalid provider_id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/invalid-provider/.well-known/openid-configuration',
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('OAUTH_CLIENT_NOT_FOUND');
    });
  });

  describe('Endpoint URL Validation', () => {
    test('should have valid endpoint URLs that can be fetched', async () => {
      const configRes = await app.inject({
        method: 'GET',
        url,
      });

      expect(configRes.statusCode).toBe(200);
      const config = configRes.json();

      // JWKS endpoint should be accessible
      const jwksUrl = new URL(config.jwks_uri);
      const jwksRes = await app.inject({
        method: 'GET',
        url: jwksUrl.pathname,
      });

      expect(jwksRes.statusCode).toBe(200);
      const jwks = jwksRes.json();
      expect(jwks.keys).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
    });
  });
});
