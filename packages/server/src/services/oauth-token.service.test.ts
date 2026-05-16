import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../entrypoints/app.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  exchangeCodeForTokens,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  refreshAccessToken,
  TEST_PKCE,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

const REFRESH_ROTATION_CLIENT = {
  clientId: 'service-refresh-rotation-client',
  clientSecret: 'service-refresh-rotation-secret',
  redirectUri: 'http://localhost:8080/service-refresh-rotation-callback',
};

const REFRESH_ROTATION_CLIENT_CONFIG = {
  id: 'service-refresh-rotation-client-config',
  name: 'Service Refresh Rotation Client',
  client_id: REFRESH_ROTATION_CLIENT.clientId,
  client_secret: REFRESH_ROTATION_CLIENT.clientSecret,
  redirect_uris: [REFRESH_ROTATION_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email offline_access',
};

async function issueRefreshableTokens(app: AppType) {
  const sessionCookie = await createAuthenticatedSession(app);
  const { code } = await getAuthorizationCode(app, {
    sessionCookie,
    clientId: REFRESH_ROTATION_CLIENT.clientId,
    redirectUri: REFRESH_ROTATION_CLIENT.redirectUri,
    scope: 'openid profile email offline_access',
    codeChallenge: TEST_PKCE.codeChallenge,
    codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
  });

  const tokenRes = await exchangeCodeForTokens(app, {
    code,
    clientId: REFRESH_ROTATION_CLIENT.clientId,
    clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
    redirectUri: REFRESH_ROTATION_CLIENT.redirectUri,
    codeVerifier: TEST_PKCE.codeVerifier,
  });

  return assertJsonBody(tokenRes, 200);
}

describe('OAuthTokenService', () => {
  describe('refresh token rotation family handling', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        clients: [REFRESH_ROTATION_CLIENT_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('reusing a rotated refresh token invalidates the token family', async () => {
      const firstTokens = await issueRefreshableTokens(app);

      const rotatedRes = await refreshAccessToken(app, {
        refreshToken: firstTokens.refresh_token,
        clientId: REFRESH_ROTATION_CLIENT.clientId,
        clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
      });
      const rotatedTokens = await assertJsonBody(rotatedRes, 200);

      const replayRes = await refreshAccessToken(app, {
        refreshToken: firstTokens.refresh_token,
        clientId: REFRESH_ROTATION_CLIENT.clientId,
        clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
      });
      const replayJson = await assertJsonBody(replayRes, 400);
      expect(replayJson.code).toBe('INVALID_REFRESH_TOKEN');

      const newestRefreshRes = await refreshAccessToken(app, {
        refreshToken: rotatedTokens.refresh_token,
        clientId: REFRESH_ROTATION_CLIENT.clientId,
        clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
      });
      const newestRefreshJson = await assertJsonBody(newestRefreshRes, 400);
      expect(newestRefreshJson.code).toBe('INVALID_REFRESH_TOKEN');

      const introspection = await services.oauthTokenService.introspectToken(
        rotatedTokens.access_token,
        'access_token',
        REFRESH_ROTATION_CLIENT.clientId,
      );
      expect(introspection.active).toBe(false);
    });

    test('concurrent refresh attempts cannot both mint usable token families', async () => {
      const tokens = await issueRefreshableTokens(app);

      const responses = await Promise.all([
        refreshAccessToken(app, {
          refreshToken: tokens.refresh_token,
          clientId: REFRESH_ROTATION_CLIENT.clientId,
          clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
        }),
        refreshAccessToken(app, {
          refreshToken: tokens.refresh_token,
          clientId: REFRESH_ROTATION_CLIENT.clientId,
          clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
        }),
      ]);

      const successfulResponses = responses.filter(
        (response) => response.status === 200,
      );
      expect(successfulResponses).toHaveLength(1);

      const [successfulResponse] = successfulResponses;
      if (!successfulResponse) {
        throw new Error('Expected one successful refresh response');
      }

      const successfulTokens = await assertJsonBody(successfulResponse, 200);
      const introspection = await services.oauthTokenService.introspectToken(
        successfulTokens.access_token,
        'access_token',
        REFRESH_ROTATION_CLIENT.clientId,
      );
      expect(introspection.active).toBe(false);
    });

    test('family revocation marker covers descendants issued after the replayed token', async () => {
      vi.useFakeTimers();
      const issuedAt = new Date('2026-01-01T00:00:00.000Z');
      vi.setSystemTime(issuedAt);

      try {
        const firstTokens = await issueRefreshableTokens(app);
        const firstRefreshToken = firstTokens.refresh_token;
        if (typeof firstRefreshToken !== 'string') {
          throw new Error('Expected first refresh token');
        }

        const refreshPayload = jose.decodeJwt(firstRefreshToken);
        const grantId = refreshPayload['grant_id'];
        if (typeof grantId !== 'string') {
          throw new Error('Expected refresh token grant_id');
        }

        const replayedAt = new Date('2026-01-01T00:10:00.000Z');
        vi.setSystemTime(replayedAt);

        const rotatedRes = await refreshAccessToken(app, {
          refreshToken: firstRefreshToken,
          clientId: REFRESH_ROTATION_CLIENT.clientId,
          clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
        });
        await assertJsonBody(rotatedRes, 200);

        const replayRes = await refreshAccessToken(app, {
          refreshToken: firstRefreshToken,
          clientId: REFRESH_ROTATION_CLIENT.clientId,
          clientSecret: REFRESH_ROTATION_CLIENT.clientSecret,
        });
        const replayJson = await assertJsonBody(replayRes, 400);
        expect(replayJson.code).toBe('INVALID_REFRESH_TOKEN');

        await withMikroContext(services, async () => {
          const marker = await services.mikro.revokedToken.findOne({
            jti: `grant:${grantId}`,
          });
          expect(marker).not.toBeNull();
          if (!marker) {
            throw new Error('Expected grant revocation marker');
          }

          const expectedMinimumExpiry = new Date(
            replayedAt.getTime() +
              services.config.tokens.refresh_token_ttl * 1000,
          );
          expect(marker.expires_at.getTime()).toBeGreaterThanOrEqual(
            expectedMinimumExpiry.getTime(),
          );
        });
      } finally {
        vi.useRealTimers();
      }
    });

    test('revokeTokenOnce treats a unique conflict as token reuse', async () => {
      await withMikroContext(services, async () => {
        const client = await services.mikro.oauthClient.findOne({
          clientId: REFRESH_ROTATION_CLIENT.clientId,
        });
        if (!client) {
          throw new Error('Expected OAuth client');
        }

        const tokenType: 'refresh_token' = 'refresh_token';
        const params = {
          jti: `race-${crypto.randomUUID()}`,
          token_type: tokenType,
          clientId: client.id,
          userSub: TEST_USER_CONFIG.sub,
          expires_at: new Date(Date.now() + 60_000),
        };

        await expect(
          services.mikro.revokedToken.revokeTokenOnce(params),
        ).resolves.toBe(true);

        const findOneSpy = vi
          .spyOn(services.mikro.revokedToken, 'findOne')
          .mockResolvedValueOnce(null);

        try {
          await expect(
            services.mikro.revokedToken.revokeTokenOnce(params),
          ).resolves.toBe(false);
        } finally {
          findOneSpy.mockRestore();
        }
      });
    });
  });

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
          aud: services.config.server.public_origin,
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
        expect(result.aud).toBe('https://auth.test.com');
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
