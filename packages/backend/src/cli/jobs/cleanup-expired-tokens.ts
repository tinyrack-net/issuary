import type { FastifyInstance } from 'fastify';
import type { Job } from './index.js';

/**
 * Cleanup Expired Tokens Job
 *
 * Removes expired entries from the revoked_tokens table.
 * Revoked tokens can be safely deleted after their original expiration time
 * since they would be invalid anyway due to JWT expiration.
 *
 * This job helps keep the database clean and improves lookup performance
 * for token revocation checks.
 */
export const cleanupExpiredTokensJob: Job = {
  name: 'cleanup-expired-tokens',
  description: 'Remove expired refresh tokens from database',
  defaultCron: '0 */6 * * *', // Every 6 hours

  async run(fastify: FastifyInstance): Promise<void> {
    const deletedCount = await fastify.mikro.revokedToken.cleanupExpired();

    if (deletedCount > 0) {
      fastify.log.info(
        { count: deletedCount },
        'Cleaned up expired revoked tokens',
      );
    } else {
      fastify.log.debug('No expired revoked tokens to clean up');
    }
  },
};
