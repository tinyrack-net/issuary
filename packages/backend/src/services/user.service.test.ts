import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserOAuthEntity } from '@/entities/user-oauth.entity.js';
import { UserPasskeyEntity } from '@/entities/user-passkey.entity.js';
import { UserTermsConsentEntity } from '@/entities/user-terms-consent.entity.js';
import { UserTotpEntity } from '@/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntity } from '@/entities/user-totp-recovery-code.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createEmailVerification,
  createPasswordReset,
  createTestOAuthClient,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('UserService', () => {
  describe('purgeDeletedUsers', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      // Clean up users (except config-managed) and related entities before each test
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        // Clean up in order to respect foreign key constraints
        await em.nativeDelete(UserTotpRecoveryCodeEntity, {});
        await em.nativeDelete(UserTotpEntity, {});
        await em.nativeDelete(UserPasskeyEntity, {});
        await em.nativeDelete(UserConsentEntity, {});
        await em.nativeDelete(UserTermsConsentEntity, {});
        await em.nativeDelete(UserOAuthEntity, {});
        await em.nativeDelete(EmailVerificationEntity, {});
        await em.nativeDelete(PasswordResetEntity, {});
        await em.nativeDelete(UserEntity, { managed_by: 'database' });
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            deleted_users: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.userService.purgeDeletedUsers({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should skip when account_deletion feature is disabled', async () => {
      const noAccountDeletionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            deleted_users: { enabled: true, retention: '0' },
          },
          account_deletion: {
            enabled: false,
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await noAccountDeletionApp.userService.purgeDeletedUsers(
          {
            dryRun: false,
          },
        );

        expect(result.skipped).toBe(true);
        expect(result.message).toBe('Account deletion feature is disabled');
      } finally {
        await noAccountDeletionApp.close();
      }
    });

    test('should return message when no users ready for deletion', async () => {
      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No users ready for permanent deletion');
    });

    test('should permanently delete users after retention period', async () => {
      // Create soft-deleted user (deleted 10 seconds ago, retention is 0)
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      const countBefore = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(countBefore).toBe(1);

      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(countAfter).toBe(0);
    });

    test('should cascade delete all related entities', async () => {
      // Create user with related entities
      const userId = await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });
      const clientId = await createTestOAuthClient(app);

      // Create related entities
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        const user = await em.findOneOrFail(UserEntity, { id: userId });

        // TOTP
        const totp = app.mikro.userTotp.create({
          user,
          secret: 'test-secret',
          verified: true,
          recovery_confirmed: true,
        });
        em.persist(totp);

        // TOTP recovery code
        const recoveryCode = app.mikro.userTotpRecoveryCode.create({
          user,
          code_hash: 'test-code-hash',
        });
        em.persist(recoveryCode);

        // Passkey
        const passkey = app.mikro.userPasskey.create({
          user,
          credential_id: 'test-credential',
          public_key: 'test-public-key',
          counter: 0,
          device_type: 'singleDevice',
          backed_up: false,
          transports: ['usb'],
        });
        em.persist(passkey);

        // User consent (OAuth)
        const consent = app.mikro.userConsent.create({
          user,
          client: clientId,
          scopes: ['openid'],
        });
        em.persist(consent);

        await em.flush();
      });

      // Create email verification and password reset
      await createEmailVerification(app, { userId });
      await createPasswordReset(app, { userId });

      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Verify all related entities are deleted
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();

        const totpCount = await em.count(UserTotpEntity, { user: userId });
        expect(totpCount).toBe(0);

        const recoveryCount = await em.count(UserTotpRecoveryCodeEntity, {
          user: userId,
        });
        expect(recoveryCount).toBe(0);

        const passkeyCount = await em.count(UserPasskeyEntity, {
          user: userId,
        });
        expect(passkeyCount).toBe(0);

        const consentCount = await em.count(UserConsentEntity, {
          user: userId,
        });
        expect(consentCount).toBe(0);

        const verificationCount = await em.count(EmailVerificationEntity, {
          user: userId,
        });
        expect(verificationCount).toBe(0);

        const resetCount = await em.count(PasswordResetEntity, {
          user: userId,
        });
        expect(resetCount).toBe(0);
      });
    });

    test('should only delete database-managed users', async () => {
      // Create a database-managed soft-deleted user
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      // Create a config-managed soft-deleted user (should not be deleted)
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'config',
      });

      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      // Only database-managed user should be deleted
      expect(result.deletedCount).toBe(1);

      // Config-managed user should remain
      const configUserCount = await countEntities(app, 'user', {
        managed_by: 'config',
      });
      expect(configUserCount).toBe(1);
    });

    test('should not delete users still within retention period', async () => {
      // Create app with 1 day retention
      const retentionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            deleted_users: { enabled: true, retention: '1d' },
          },
          account_deletion: {
            enabled: true,
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        // Create user deleted 1 hour ago (within 1 day retention)
        await createTestUser(retentionApp, {
          deletedAt: new Date(Date.now() - 60 * 60 * 1000),
          managedBy: 'database',
        });

        // Create user deleted 2 days ago (past retention)
        await createTestUser(retentionApp, {
          deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          managedBy: 'database',
        });

        const result = await retentionApp.userService.purgeDeletedUsers({
          dryRun: false,
        });

        // Only the 2-day old user should be deleted
        expect(result.deletedCount).toBe(1);
        expect(result.message).toContain('1 day');
      } finally {
        await retentionApp.close();
      }
    });

    test('should not delete non-deleted users', async () => {
      // Create active user (not deleted)
      await createTestUser(app, {
        deletedAt: null,
        managedBy: 'database',
      });

      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(0);

      // User should remain
      const userCount = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(userCount).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 20000),
        managedBy: 'database',
      });

      const result = await app.userService.purgeDeletedUsers({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Users should NOT be deleted
      const userCount = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(userCount).toBe(2);
    });

    test('should handle multiple users correctly', async () => {
      // Create 3 soft-deleted users
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 20000),
        managedBy: 'database',
      });
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 30000),
        managedBy: 'database',
      });

      const result = await app.userService.purgeDeletedUsers({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(3);

      const userCount = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(userCount).toBe(0);
    });
  });
});
