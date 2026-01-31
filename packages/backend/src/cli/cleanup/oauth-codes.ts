import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * OAuth Authorization Codes Cleanup Task
 *
 * Removes expired OAuth authorization codes from the database.
 * Authorization codes have a short lifetime (typically 10 minutes)
 * and should be cleaned up regularly to prevent database bloat.
 *
 * Also cleans up consumed codes after the configured retention period.
 */
export const oauthCodesTask: CleanupTask = {
  name: 'oauth-codes',
  description: 'Remove expired and consumed OAuth authorization codes',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.oauth_codes;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const now = new Date();
    const consumedRetentionMs = parseDurationToMs(config.consumed_retention);
    const consumedCutoffDate = calculateCutoffDate(config.consumed_retention);

    // Find expired authorization codes
    const expiredCodes = await ctx.fastify.mikro.oauthCode.find({
      expiredAt: { $lt: now },
    });

    // Find consumed codes older than retention period
    const consumedCodes = await ctx.fastify.mikro.oauthCode.find({
      consumedAt: { $ne: null, $lt: consumedCutoffDate },
    });

    const expiredCount = expiredCodes.length;
    const consumedCount = consumedCodes.length;
    const totalCount = expiredCount + consumedCount;

    if (totalCount === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No expired or consumed codes',
      };
    }

    if (ctx.dryRun) {
      return {
        deletedCount: totalCount,
        skipped: false,
        message: `Would delete ${expiredCount} expired, ${consumedCount} consumed (retention: ${formatDuration(consumedRetentionMs)})`,
      };
    }

    // Delete the codes
    const em = ctx.fastify.mikro.orm.em.fork();
    for (const code of expiredCodes) {
      em.remove(code);
    }
    for (const code of consumedCodes) {
      em.remove(code);
    }
    await em.flush();

    return {
      deletedCount: totalCount,
      skipped: false,
      message: `${expiredCount} expired, ${consumedCount} consumed`,
    };
  },
};
