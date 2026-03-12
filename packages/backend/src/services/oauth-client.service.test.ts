import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { OAuthClientEntitySchema } from '#backend/entities/oauth-client.entity.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  createTestApp,
  createTestOAuthClient,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('OAuthClientService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp(MINIMAL_TEST_CONFIG);
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('verifyClientSecret distinguishes confidential and public clients', async () => {
    await createTestOAuthClient(services, {
      clientId: 'confidential-client',
    });

    await withMikroContext(services, async () => {
      const publicClient = services.mikro.em.create(OAuthClientEntitySchema, {
        clientId: 'public-client',
        clientSecretHash: null,
        name: 'Public Client',
        redirectUris: ['http://localhost/public/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scopes: ['openid'],
        enabled: true,
        managed_by: 'database',
      });
      await services.mikro.em.persist(publicClient).flush();
    });

    await expect(
      withMikroContext(services, async () =>
        services.oauthClientService.verifyClientSecret(
          'confidential-client',
          'test-secret-hash',
        ),
      ),
    ).resolves.toBe(true);

    await expect(
      withMikroContext(services, async () =>
        services.oauthClientService.verifyClientSecret(
          'confidential-client',
          'wrong-secret',
        ),
      ),
    ).resolves.toBe(false);

    await expect(
      withMikroContext(services, async () =>
        services.oauthClientService.verifyClientSecret(
          'public-client',
          'any-secret',
        ),
      ),
    ).resolves.toBe(false);
  });

  test('validateScopes exposes the invalid scopes that were requested', async () => {
    await createTestOAuthClient(services, {
      clientId: 'scope-client',
    });

    const client = await withMikroContext(services, async () =>
      services.oauthClientService.findByClientId('scope-client'),
    );

    try {
      services.oauthClientService.validateScopes(client, ['openid', 'admin']);
      expect.unreachable('Expected validateScopes to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toHaveProperty('code', 'INVALID_SCOPE');
      expect(err).toHaveProperty('data.invalidScopes', ['admin']);
    }
  });
});
