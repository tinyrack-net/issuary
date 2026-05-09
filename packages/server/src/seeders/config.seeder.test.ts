import { describe, expect, test } from 'vitest';
import { UserEntity } from '../entities/user.entity.ts';
import { TinyAuthRuntimeConfigSchema } from '../lib/config/index.ts';
import type { ServiceContainer } from '../services/container.ts';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
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
      const resolvedConfig = TinyAuthRuntimeConfigSchema.parse(inputConfig);

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
      const changedConfig = TinyAuthRuntimeConfigSchema.parse({
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
});
