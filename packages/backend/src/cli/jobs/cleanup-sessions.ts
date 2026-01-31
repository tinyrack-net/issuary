import type { FastifyInstance } from 'fastify';
import type { Job } from './index.js';

/**
 * Cleanup Sessions Job
 *
 * Removes expired OAuth authorization codes from the database.
 * Authorization codes have a short lifetime (typically 10 minutes)
 * and should be cleaned up regularly to prevent database bloat.
 *
 * Also cleans up consumed codes that are no longer needed.
 */
export const cleanupSessionsJob: Job = {
  name: 'cleanup-sessions',
  description: 'Clean up expired OAuth sessions and authorization codes',
  defaultCron: '0 1 * * *', // Daily at 1 AM

  async run(fastify: FastifyInstance): Promise<void> {
    const em = fastify.mikro.orm.em.fork();
    const now = new Date();

    // Clean up expired authorization codes
    const expiredCodes = await fastify.mikro.oauthCode.find({
      expiredAt: { $lt: now },
    });

    // Clean up consumed codes older than 24 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const consumedCodes = await fastify.mikro.oauthCode.find({
      consumedAt: { $lt: oneDayAgo },
    });

    const totalToDelete = expiredCodes.length + consumedCodes.length;

    if (totalToDelete === 0) {
      fastify.log.debug('No expired or consumed OAuth codes to clean up');
      return;
    }

    for (const code of expiredCodes) {
      em.remove(code);
    }

    for (const code of consumedCodes) {
      em.remove(code);
    }

    await em.flush();

    fastify.log.info(
      {
        expiredCodes: expiredCodes.length,
        consumedCodes: consumedCodes.length,
        total: totalToDelete,
      },
      'Cleaned up OAuth authorization codes',
    );
  },
};
