import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * Password Resets Cleanup Task
 *
 * Removes expired password reset tokens from the database.
 * Expired tokens are no longer valid and can be safely deleted.
 *
 * The retention period allows keeping expired tokens for a while longer
 * for debugging purposes. Default is "0" (immediate cleanup after expiry).
 */
export const passwordResetsTask: CleanupTask = {
  name: 'password-resets',
  description: 'Remove expired password reset tokens',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.password_resets;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Count expired tokens before the cutoff date
    const count = await ctx.fastify.mikro.passwordReset.count({
      expiresAt: { $lt: cutoffDate },
      used: false,
    });

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (ctx.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Use native delete for efficiency
    const deletedCount = await ctx.fastify.mikro.passwordReset.nativeDelete({
      expiresAt: { $lt: cutoffDate },
      used: false,
    });

    if (retentionMs > 0) {
      return {
        deletedCount,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount,
      skipped: false,
    };
  },
};
