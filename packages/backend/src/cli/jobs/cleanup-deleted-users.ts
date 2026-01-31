import type { FastifyInstance } from 'fastify';
import { parseDurationToMs } from '@/lib/config/schemas/account-deletion.js';
import type { Job } from './index.js';

/**
 * Cleanup Deleted Users Job
 *
 * Permanently removes users who have requested account deletion
 * and whose retention period has expired.
 *
 * This is a destructive operation that:
 * 1. Deletes all user-related data (OAuth accounts, TOTP, passkeys, consents)
 * 2. Removes the user record permanently
 *
 * The retention period is configured in account_deletion.retention_period
 * (e.g., "30d", "90d").
 */
export const cleanupDeletedUsersJob: Job = {
  name: 'cleanup-deleted-users',
  description: 'Permanently delete users after retention period',
  defaultCron: '0 2 * * 0', // Weekly on Sunday at 2 AM

  async run(fastify: FastifyInstance): Promise<void> {
    if (!fastify.config.account_deletion.enabled) {
      fastify.log.debug(
        'Account deletion is disabled in config, skipping cleanup',
      );
      return;
    }

    const retentionPeriod = fastify.config.account_deletion.retention_period;
    const retentionMs = parseDurationToMs(retentionPeriod);
    const cutoffDate = new Date(Date.now() - retentionMs);

    // Find users marked for deletion whose retention period has expired
    const usersToDelete = await fastify.mikro.user.find({
      deleted_at: { $ne: null, $lt: cutoffDate },
      managed_by: 'database', // Only delete database-managed users
    });

    if (usersToDelete.length === 0) {
      fastify.log.debug('No users ready for permanent deletion');
      return;
    }

    const em = fastify.mikro.orm.em.fork();
    let deletedCount = 0;

    for (const user of usersToDelete) {
      try {
        // Delete related entities first (cascading delete)
        // OAuth accounts
        const oauthAccounts = await fastify.mikro.userOAuth.find({
          user: user.id,
        });
        for (const account of oauthAccounts) {
          em.remove(account);
        }

        // TOTP
        const totps = await fastify.mikro.userTotp.find({ user: user.id });
        for (const totp of totps) {
          em.remove(totp);
        }

        // TOTP recovery codes
        const recoveryCodes = await fastify.mikro.userTotpRecoveryCode.find({
          user: user.id,
        });
        for (const code of recoveryCodes) {
          em.remove(code);
        }

        // Passkeys
        const passkeys = await fastify.mikro.userPasskey.find({
          user: user.id,
        });
        for (const passkey of passkeys) {
          em.remove(passkey);
        }

        // User consents
        const consents = await fastify.mikro.userConsent.find({
          user: user.id,
        });
        for (const consent of consents) {
          em.remove(consent);
        }

        // User terms consents
        const termsConsents = await fastify.mikro.userTermsConsent.find({
          user: user.id,
        });
        for (const consent of termsConsents) {
          em.remove(consent);
        }

        // Email verifications
        const verifications = await fastify.mikro.emailVerification.find({
          user: user.id,
        });
        for (const verification of verifications) {
          em.remove(verification);
        }

        // Password resets
        const passwordResets = await fastify.mikro.passwordReset.find({
          user: user.id,
        });
        for (const reset of passwordResets) {
          em.remove(reset);
        }

        // Finally delete the user
        em.remove(user);
        deletedCount++;
      } catch (error) {
        fastify.log.error(
          { userId: user.id, error },
          'Failed to delete user data',
        );
      }
    }

    await em.flush();

    fastify.log.info(
      { count: deletedCount, retentionPeriod },
      'Permanently deleted users after retention period',
    );
  },
};
