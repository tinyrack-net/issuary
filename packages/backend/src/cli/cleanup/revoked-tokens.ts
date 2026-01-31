import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * Revoked Tokens Cleanup Task
 *
 * Removes expired entries from the revoked_tokens table.
 * Revoked tokens can be safely deleted after their original expiration time
 * since they would be invalid anyway due to JWT expiration.
 *
 * The retention period allows keeping expired tokens for a while longer
 * for debugging purposes. Default is "0" (immediate cleanup after expiry).
 */
export const revokedTokensTask: CleanupTask = {
  name: 'revoked-tokens',
  description: 'Remove expired revoked tokens',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.revoked_tokens;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find tokens that expired before the cutoff date
    const expiredTokens = await ctx.fastify.mikro.revokedToken.find({
      expires_at: { $lt: cutoffDate },
    });

    const count = expiredTokens.length;

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

    // Delete the tokens
    const em = ctx.fastify.mikro.orm.em.fork();
    for (const token of expiredTokens) {
      em.remove(token);
    }
    await em.flush();

    if (retentionMs > 0) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount: count,
      skipped: false,
    };
  },
};
