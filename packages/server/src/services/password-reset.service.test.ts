import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

describe('PasswordResetService', () => {
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

  test('requestPasswordReset invalidates previously issued unused tokens', async () => {
    const email = generateUniqueEmail('password-reset-service');

    await withMikroContext(services, async () => {
      await services.passwordAuthService.createDatabaseUser({
        email,
        password: 'initial-password-123',
      });

      const first =
        await services.passwordResetService.requestPasswordReset(email);
      const second =
        await services.passwordResetService.requestPasswordReset(email);

      expect(first?.token).not.toBe(second?.token);

      const verifiedFirst = await services.mikro.passwordReset.verifyToken(
        first?.token ?? '',
      );
      const verifiedSecond = await services.mikro.passwordReset.verifyToken(
        second?.token ?? '',
      );

      expect(verifiedFirst).toBeNull();
      expect(verifiedSecond?.token).toBe(second?.token);
    });
  });

  test('resetPassword replaces the stored password for database-managed users', async () => {
    const email = generateUniqueEmail('password-reset-success');
    let resetToken = '';

    await withMikroContext(services, async () => {
      const user = await services.passwordAuthService.createDatabaseUser({
        email,
        password: 'old-password-123',
      });
      const token = await services.passwordResetService.generateToken({
        userSub: user.sub,
      });
      await services.mikro.em.flush();
      resetToken = token.token;
    });

    await withMikroContext(services, async () => {
      const user = await services.passwordResetService.resetPassword({
        token: resetToken,
        password: 'new-password-456',
      });
      expect(user.email).toBe(email);
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordAuthService.authenticateByEmailAndPassword({
          email,
          password: 'old-password-123',
        }),
      ),
    ).rejects.toHaveProperty('code', 'INVALID_EMAIL_OR_PASSWORD');

    await withMikroContext(services, async () => {
      const user =
        await services.passwordAuthService.authenticateByEmailAndPassword({
          email,
          password: 'new-password-456',
        });
      expect(user.email).toBe(email);
    });
  });

  test('resetPassword rejects config-managed users even with a valid token', async () => {
    const email = generateUniqueEmail('password-reset-config');
    let resetToken = '';

    await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.managed_by = 'config';
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      const token = await services.mikro.passwordReset.generateToken({
        userSub: user.sub,
      });
      await services.mikro.em.flush();
      resetToken = token.token;
    });

    await expect(
      withMikroContext(services, async () =>
        services.passwordResetService.resetPassword({
          token: resetToken,
          password: 'new-password-789',
        }),
      ),
    ).rejects.toHaveProperty('code', 'USER_NOT_EDITABLE');
  });
});
