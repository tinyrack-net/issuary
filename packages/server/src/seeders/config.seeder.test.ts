import { describe, expect, test } from 'vitest';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import { IssuaryRuntimeConfigSchema } from '../lib/config/index.ts';
import type { ServiceContainer } from '../services/container.ts';
import { createOAuthCode, createTestOAuthClient } from '../test-utils/cli.ts';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../test-utils/index.ts';
import { seedConfigIfNeeded } from './config.seeder.ts';

async function readConfigUserPasswordHash(
  services: ServiceContainer,
): Promise<string> {
  const em = services.mikro.orm.em.fork();
  const user = await em.findOne(
    UserEntity,
    { sub: TEST_USER_CONFIG.sub },
    { populate: ['password_hash'] },
  );

  if (!user?.password_hash) {
    throw new Error('Expected config user password hash to exist.');
  }

  return user.password_hash;
}

describe('seedConfigIfNeeded', () => {
  test('skips config seeding when the seed fingerprint is unchanged', async () => {
    const inputConfig = {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    };
    const { services, cleanup } = await createTestApp(inputConfig);

    try {
      const firstPasswordHash = await readConfigUserPasswordHash(services);
      const resolvedConfig = IssuaryRuntimeConfigSchema.parse(inputConfig);

      const seeded = await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        resolvedConfig,
        services.securityService,
      );

      const secondPasswordHash = await readConfigUserPasswordHash(services);

      expect(seeded).toBe(false);
      expect(secondPasswordHash).toBe(firstPasswordHash);
    } finally {
      await cleanup();
    }
  });

  test('reseeds config when the seed fingerprint changes', async () => {
    const inputConfig = {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
    };
    const { services, cleanup } = await createTestApp(inputConfig);

    try {
      const firstPasswordHash = await readConfigUserPasswordHash(services);
      const changedConfig = IssuaryRuntimeConfigSchema.parse({
        ...inputConfig,
        users: [
          {
            ...TEST_USER_CONFIG,
            password: 'new-config-password',
          },
        ],
      });

      const seeded = await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        changedConfig,
        services.securityService,
      );

      const secondPasswordHash = await readConfigUserPasswordHash(services);

      expect(seeded).toBe(true);
      expect(secondPasswordHash).not.toBe(firstPasswordHash);
      await expect(
        services.securityService.verifyPassword(
          secondPasswordHash,
          'new-config-password',
        ),
      ).resolves.toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('soft-deletes removed config clients, preserves database clients, and restores without reviving the old epoch', async () => {
    const inputConfig = {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    };
    const { services, cleanup } = await createTestApp(inputConfig);

    try {
      const configClient = await services.mikro.orm.em
        .fork()
        .findOneOrFail(OAuthClientEntitySchema, {
          id: TEST_OAUTH_CLIENT_CONFIG.id,
        });
      await createOAuthCode(services, {
        clientId: configClient.id,
        userSub: TEST_USER_CONFIG.sub,
      });
      const databaseClientId = await createTestOAuthClient(services, {
        clientId: 'database-client-preserved-by-config-sync',
      });
      const removedConfig = IssuaryRuntimeConfigSchema.parse({
        ...inputConfig,
        clients: [],
      });

      await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        removedConfig,
        services.securityService,
      );

      const removedClient = await services.mikro.orm.em
        .fork()
        .findOneOrFail(OAuthClientEntitySchema, {
          id: TEST_OAUTH_CLIENT_CONFIG.id,
        });
      expect(removedClient.deletedAt).toBeInstanceOf(Date);
      expect(removedClient.tokenEpoch).toEqual(expect.any(String));
      const deletedEpoch = removedClient.tokenEpoch;
      await expect(
        services.mikro.orm.em.fork().findOneOrFail(OAuthClientEntitySchema, {
          id: databaseClientId,
        }),
      ).resolves.toBeDefined();

      await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        removedConfig,
        services.securityService,
        'always',
      );
      const repeatedlyRemoved = await services.mikro.orm.em
        .fork()
        .findOneOrFail(OAuthClientEntitySchema, {
          id: TEST_OAUTH_CLIENT_CONFIG.id,
        });
      expect(repeatedlyRemoved.tokenEpoch).toBe(deletedEpoch);

      await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        IssuaryRuntimeConfigSchema.parse(inputConfig),
        services.securityService,
      );
      const restoredClient = await services.mikro.orm.em
        .fork()
        .findOneOrFail(OAuthClientEntitySchema, {
          id: TEST_OAUTH_CLIENT_CONFIG.id,
        });
      expect(restoredClient.deletedAt).toBeNull();
      expect(restoredClient.tokenEpoch).toBe(deletedEpoch);
    } finally {
      await cleanup();
    }
  });
});
