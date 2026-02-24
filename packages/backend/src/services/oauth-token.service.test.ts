import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '#backend/server.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('OAuthTokenService', () => {
  describe('introspectToken', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const server = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            host: 'https://auth.test.com',
          },
        },
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;

      // Sign test tokens once for all introspection tests
      await withMikroContext(services, async () => {
        accessToken = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: 'user-introspect',
          client_id: 'client-introspect',
          scope: 'openid email',
        });

        refreshToken = await services.jwtService.signRefreshToken({
          typ: 'refresh_token',
          sub: 'user-introspect',
          client_id: 'client-introspect',
          scope: 'openid email',
        });
      });
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return active=true for valid access token with correct hint', async () => {
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken(
          accessToken,
          'access_token',
        );

        expect(result.active).toBe(true);
        expect(result.scope).toBe('openid email');
        expect(result.client_id).toBe('client-introspect');
        expect(result.token_type).toBe('Bearer');
        expect(result.sub).toBe('user-introspect');
        expect(result.iss).toBe('https://auth.test.com');
        expect(result.exp).toBeDefined();
        expect(result.iat).toBeDefined();
      });
    });

    test('should return active=true for valid refresh token with correct hint', async () => {
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken(
          refreshToken,
          'refresh_token',
        );

        expect(result.active).toBe(true);
        expect(result.scope).toBe('openid email');
        expect(result.client_id).toBe('client-introspect');
        expect(result.sub).toBe('user-introspect');
      });
    });

    test('should return active=true for access token with wrong hint (refresh_token)', async () => {
      // hint says refresh_token but it's actually an access token
      // should fall back and still succeed
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken(
          accessToken,
          'refresh_token',
        );

        expect(result.active).toBe(true);
        expect(result.sub).toBe('user-introspect');
      });
    });

    test('should return active=true for refresh token with wrong hint (access_token)', async () => {
      // hint says access_token but it's actually a refresh token
      // should fall back and still succeed
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken(
          refreshToken,
          'access_token',
        );

        expect(result.active).toBe(true);
        expect(result.sub).toBe('user-introspect');
      });
    });

    test('should return active=true for valid token without hint', async () => {
      await withMikroContext(services, async () => {
        const result =
          await services.oauthTokenService.introspectToken(accessToken);

        expect(result.active).toBe(true);
        expect(result.sub).toBe('user-introspect');
      });
    });

    test('should return active=false for malformed token', async () => {
      await withMikroContext(services, async () => {
        const result =
          await services.oauthTokenService.introspectToken('garbage-not-a-jwt');

        expect(result.active).toBe(false);
        expect(result.scope).toBeUndefined();
        expect(result.client_id).toBeUndefined();
      });
    });

    test('should return active=false for empty token', async () => {
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken('');

        expect(result.active).toBe(false);
      });
    });

    test('should return active=false for malformed token with hint', async () => {
      await withMikroContext(services, async () => {
        const result = await services.oauthTokenService.introspectToken(
          'invalid',
          'access_token',
        );

        expect(result.active).toBe(false);
      });
    });
  });
});
