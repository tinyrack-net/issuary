import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

const LEGACY_PASSWORD_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=4mV_6YDQh9NV944YrmvTGZdp0EOyT-ZPwJGqSTnkS04';

describe('PasswordAuthService', () => {
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

  test('authenticates a user with the correct password', async () => {
    const email = generateUniqueEmail('password-auth-success');
    const password = 'correct-password-123';

    await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    const user = await withMikroContext(services, async () =>
      services.passwordAuthService.authenticateByEmailAndPassword({
        email,
        password,
      }),
    );

    expect(user.email).toBe(email);
  });

  test('rehashes a legacy password after successful authentication', async () => {
    const email = generateUniqueEmail('password-auth-legacy-rehash');

    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: LEGACY_PASSWORD_HASH,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    await withMikroContext(services, async () =>
      services.passwordAuthService.authenticateByEmailAndPassword({
        email,
        password: 'legacy password',
      }),
    );

    const migratedHash = await withMikroContext(services, async () => {
      const user =
        await services.mikro.user.findActiveByEmailForPasswordAuth(email);
      return user.password_hash;
    });
    expect(migratedHash).toMatch(/^pbkdf2-sha256\$v=2\$/);
  });

  test('rejects authentication with the wrong password', async () => {
    const email = generateUniqueEmail('password-auth-wrong-password');
    const password = 'correct-password-123';

    await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.authenticateByEmailAndPassword({
          email,
          password: 'wrong-password-123',
        }),
      ),
    ).rejects.toHaveProperty('code', 'INVALID_EMAIL_OR_PASSWORD');
  });

  test('createDatabaseUser stores a hashed password', async () => {
    const email = generateUniqueEmail('password-auth-create-user');
    const password = 'created-password-123';

    const user = await withMikroContext(services, async () =>
      services.passwordAuthService.createDatabaseUser({
        email,
        password,
      }),
    );

    await withMikroContext(services, async () => {
      await services.mikro.em.populate(user, ['password_hash']);
    });

    expect(user.password_hash).not.toBe(password);
    expect(user.password_hash?.startsWith('pbkdf2-sha256$')).toBe(true);

    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        password,
      ),
    ).resolves.toBe(true);
  });

  test('setPasswordForUser rejects config-managed users', async () => {
    const email = generateUniqueEmail('password-auth-config-user');

    const user = await withMikroContext(services, async () => {
      const createdUser = services.mikro.user.create({
        email,
        password_hash: null,
      });
      createdUser.email_verified = true;
      createdUser.managed_by = 'config';
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.setPasswordForUser(
          user,
          'replacement-password-123',
        ),
      ),
    ).rejects.toHaveProperty('code', 'USER_NOT_EDITABLE');
  });

  test('setPasswordForUser rejects users who already have a password', async () => {
    const email = generateUniqueEmail('password-auth-already-set');

    const user = await withMikroContext(services, async () => {
      const passwordHash = await services.securityService.hashPassword(
        'existing-password-123',
      );
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.setPasswordForUser(
          user,
          'replacement-password-123',
        ),
      ),
    ).rejects.toHaveProperty('code', 'PASSWORD_ALREADY_SET');
  });

  test('changePassword rejects the wrong current password', async () => {
    const email = generateUniqueEmail('password-auth-change-wrong-current');

    const user = await withMikroContext(services, async () => {
      const passwordHash = await services.securityService.hashPassword(
        'current-password-123',
      );
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.changePassword(
          user,
          'wrong-password-123',
          'next-password-123',
        ),
      ),
    ).rejects.toHaveProperty('code', 'INVALID_CURRENT_PASSWORD');
  });

  test('removePassword succeeds when user has OAuth accounts', async () => {
    const email = generateUniqueEmail('password-auth-remove-with-oauth');
    const password = 'current-password-123';

    const user = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();

      const oauthAccount = services.mikro.userOAuth.create({
        user: createdUser,
        provider_name: 'google',
        provider_user_id: 'oauth-user-id-123',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      });
      await services.mikro.em.persist(oauthAccount).flush();

      return createdUser;
    });

    await withMikroContext(services, async () => {
      await services.passwordAuthService.removePassword(user, password);
    });

    expect(user.password_hash).toBeNull();
  });

  test('changePassword full success path', async () => {
    const email = generateUniqueEmail('password-auth-change-success');
    const currentPassword = 'current-password-123';
    const newPassword = 'new-password-456';

    const user = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(currentPassword);
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await withMikroContext(services, async () => {
      await services.passwordAuthService.changePassword(
        user,
        currentPassword,
        newPassword,
      );
    });

    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        currentPassword,
      ),
    ).resolves.toBe(false);

    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        newPassword,
      ),
    ).resolves.toBe(true);
  });

  test('setPasswordForUser success for OAuth-only user', async () => {
    const email = generateUniqueEmail('password-auth-set-oauth-only');
    const newPassword = 'new-password-123';

    const user = await withMikroContext(services, async () => {
      const createdUser = services.mikro.user.create({
        email,
        password_hash: null,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await withMikroContext(services, async () => {
      await services.passwordAuthService.setPasswordForUser(user, newPassword);
    });

    expect(user.password_hash).not.toBeNull();
    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        newPassword,
      ),
    ).resolves.toBe(true);
  });

  test('removePassword rejects second-factor-only users without OAuth', async () => {
    const email = generateUniqueEmail('password-auth-remove-2fa-only');

    const user = await withMikroContext(services, async () => {
      const passwordHash = await services.securityService.hashPassword(
        'current-password-123',
      );
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();

      const totp = services.mikro.userTotp.create({
        user: createdUser.sub,
        secret: 'test-totp-secret',
        verified: true,
        recovery_confirmed: true,
      });
      await services.mikro.em.persist(totp).flush();

      return createdUser;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.removePassword(
          user,
          'current-password-123',
        ),
      ),
    ).rejects.toHaveProperty(
      'code',
      'CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY',
    );
  });

  test('replacePassword updates the stored hash', async () => {
    const email = generateUniqueEmail('password-auth-replace');

    const user = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword('old-password-123');
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    const previousHash = user.password_hash;

    await withMikroContext(services, async () => {
      await services.passwordAuthService.replacePassword(
        user,
        'new-password-123',
      );
    });

    expect(user.password_hash).not.toBe(previousHash);
    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        'new-password-123',
      ),
    ).resolves.toBe(true);
    await expect(
      services.securityService.verifyPassword(
        user.password_hash ?? '',
        'old-password-123',
      ),
    ).resolves.toBe(false);
  });
});

describe('PasswordAuthService with custom password policy', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          policy: {
            min_length: 4,
            max_length: 6,
          },
        },
      },
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('createDatabaseUser accepts passwords within the configured bounds', async () => {
    const email = generateUniqueEmail('password-auth-custom-policy-ok');

    const user = await withMikroContext(services, async () =>
      services.passwordAuthService.createDatabaseUser({
        email,
        password: '1234',
      }),
    );

    expect(user.password_hash?.startsWith('pbkdf2-sha256$')).toBe(true);
  });

  test('createDatabaseUser rejects passwords shorter than the configured minimum', async () => {
    const email = generateUniqueEmail('password-auth-custom-policy-short');

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.createDatabaseUser({
          email,
          password: '123',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      data: 'Password must be at least 4 characters long.',
    });
  });

  test('replacePassword rejects passwords longer than the configured maximum', async () => {
    const email = generateUniqueEmail('password-auth-custom-policy-long');

    const user = await withMikroContext(services, async () => {
      const passwordHash = await services.securityService.hashPassword('1234');
      const createdUser = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      createdUser.email_verified = true;
      await services.mikro.em.persist(createdUser).flush();
      return createdUser;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.replacePassword(user, '1234567'),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      data: 'Password must be at most 6 characters long.',
    });
  });
});
