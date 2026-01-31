import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * Email Verifications Cleanup Task
 *
 * Removes expired email verification tokens from the database.
 * Expired tokens are no longer valid and can be safely deleted.
 *
 * The retention period allows keeping expired tokens for a while longer
 * for debugging purposes. Default is "0" (immediate cleanup after expiry).
 */
export const emailVerificationsTask: CleanupTask = {
  name: 'email-verifications',
  description: 'Remove expired email verification tokens',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.email_verifications;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Fork EntityManager for CLI context isolation
    const em = ctx.fastify.mikro.orm.em.fork();
    const emailVerificationRepo = em.getRepository(EmailVerificationEntity);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Count expired tokens before the cutoff date
    const count = await emailVerificationRepo.count({
      expiresAt: { $lt: cutoffDate },
      verified: false,
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
    const deletedCount = await emailVerificationRepo.nativeDelete({
      expiresAt: { $lt: cutoffDate },
      verified: false,
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
