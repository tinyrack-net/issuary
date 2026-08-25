import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import {
  createTestApp,
  createTestOAuthClient,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

const LEGACY_CLIENT_SECRET_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=GrZeZmD7qg6eQEyybxBo5CbbX3nwcJ_tQKgV8eGFlYE';

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

  test('rehashes a legacy client secret after successful verification', async () => {
    await withMikroContext(services, async () => {
      const client = services.mikro.em.create(OAuthClientEntitySchema, {
        clientId: 'legacy-confidential-client',
        clientSecretHash: LEGACY_CLIENT_SECRET_HASH,
        name: 'Legacy Confidential Client',
        redirectUris: ['http://localhost/legacy/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scopes: ['openid'],
        enabled: true,
        managed_by: 'database',
      });
      await services.mikro.em.persist(client).flush();
    });

    await expect(
      withMikroContext(services, async () =>
        services.oauthClientService.verifyClientSecret(
          'legacy-confidential-client',
          'legacy client secret',
        ),
      ),
    ).resolves.toBe(true);

    const migratedHash = await withMikroContext(services, async () => {
      const client = await services.mikro.oauthClient.findOneOrFail(
        { clientId: 'legacy-confidential-client' },
        { populate: ['clientSecretHash'] },
      );
      return client.clientSecretHash;
    });
    expect(migratedHash).toMatch(/^pbkdf2-sha256\$v=2\$/);
  });
});
