import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

describe('OAuthTokenService', () => {
  describe('introspectToken', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let accessToken: string;
    let refreshToken: string;
    let tokenSubject: string;
    const tokenClientId = 'client-introspect';

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        server: {
          public_origin: 'https://auth.test.com',
        },
      });
      services = server.services;
      cleanup = server.cleanup;
      tokenSubject = await createTestUser(services);
      await createTestOAuthClient(services, { clientId: tokenClientId });

      // Sign test tokens once for all introspection tests
      await withMikroContext(services, async () => {
        accessToken = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid email',
        });

        refreshToken = await services.jwtService.signRefreshToken({
          typ: 'refresh_token',
          sub: tokenSubject,
          client_id: tokenClientId,
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
        expect(result.client_id).toBe(tokenClientId);
        expect(result.token_type).toBe('Bearer');
        expect(result.sub).toBe(tokenSubject);
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
        expect(result.client_id).toBe(tokenClientId);
        expect(result.sub).toBe(tokenSubject);
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
        expect(result.sub).toBe(tokenSubject);
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
        expect(result.sub).toBe(tokenSubject);
      });
    });

    test('should return active=true for valid token without hint', async () => {
      await withMikroContext(services, async () => {
        const result =
          await services.oauthTokenService.introspectToken(accessToken);

        expect(result.active).toBe(true);
        expect(result.sub).toBe(tokenSubject);
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
