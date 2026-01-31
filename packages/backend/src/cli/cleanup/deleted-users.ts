import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * Deleted Users Cleanup Task
 *
 * Permanently removes users who have requested account deletion
 * and whose retention period has expired.
 *
 * This is a destructive operation that:
 * 1. Deletes all user-related data (OAuth accounts, TOTP, passkeys, consents)
 * 2. Removes the user record permanently
 *
 * The retention period is configured in cleanup.deleted_users.retention
 * (e.g., "30d", "90d").
 */
export const deletedUsersTask: CleanupTask = {
  name: 'deleted-users',
  description: 'Permanently delete users after retention period',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.deleted_users;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Check if account deletion feature is enabled
    if (!ctx.fastify.config.account_deletion.enabled) {
      return {
        deletedCount: 0,
        skipped: true,
        message: 'Account deletion feature is disabled',
      };
    }

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find users marked for deletion whose retention period has expired
    const usersToDelete = await ctx.fastify.mikro.user.find({
      deleted_at: { $ne: null, $lt: cutoffDate },
      managed_by: 'database', // Only delete database-managed users
    });

    if (usersToDelete.length === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No users ready for permanent deletion',
      };
    }

    if (ctx.dryRun) {
      return {
        deletedCount: usersToDelete.length,
        skipped: false,
        message: `Would delete ${usersToDelete.length} users (retention: ${formatDuration(retentionMs)})`,
      };
    }

    const em = ctx.fastify.mikro.orm.em.fork();
    let deletedCount = 0;

    for (const user of usersToDelete) {
      try {
        // Delete related entities first (cascading delete)
        // OAuth accounts
        const oauthAccounts = await ctx.fastify.mikro.userOAuth.find({
          user: user.id,
        });
        for (const account of oauthAccounts) {
          em.remove(account);
        }

        // TOTP
        const totps = await ctx.fastify.mikro.userTotp.find({ user: user.id });
        for (const totp of totps) {
          em.remove(totp);
        }

        // TOTP recovery codes
        const recoveryCodes = await ctx.fastify.mikro.userTotpRecoveryCode.find(
          {
            user: user.id,
          },
        );
        for (const code of recoveryCodes) {
          em.remove(code);
        }

        // Passkeys
        const passkeys = await ctx.fastify.mikro.userPasskey.find({
          user: user.id,
        });
        for (const passkey of passkeys) {
          em.remove(passkey);
        }

        // User consents
        const consents = await ctx.fastify.mikro.userConsent.find({
          user: user.id,
        });
        for (const consent of consents) {
          em.remove(consent);
        }

        // User terms consents
        const termsConsents = await ctx.fastify.mikro.userTermsConsent.find({
          user: user.id,
        });
        for (const consent of termsConsents) {
          em.remove(consent);
        }

        // Email verifications
        const verifications = await ctx.fastify.mikro.emailVerification.find({
          user: user.id,
        });
        for (const verification of verifications) {
          em.remove(verification);
        }

        // Password resets
        const passwordResets = await ctx.fastify.mikro.passwordReset.find({
          user: user.id,
        });
        for (const reset of passwordResets) {
          em.remove(reset);
        }

        // Finally delete the user
        em.remove(user);
        deletedCount++;
      } catch (error) {
        ctx.fastify.log.error(
          { userId: user.id, error },
          'Failed to delete user data',
        );
      }
    }

    await em.flush();

    return {
      deletedCount,
      skipped: false,
      message: `Retention: ${formatDuration(retentionMs)}`,
    };
  },
};
