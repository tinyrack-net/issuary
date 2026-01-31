import type { FastifyInstance } from 'fastify';
import type { Job } from './index.js';

/**
 * JWT Key Rotation Job
 *
 * Checks for expired active JWT signing keys and performs rotation if needed.
 * Also retires old keys that have passed the overlap period.
 *
 * Key lifecycle:
 * 1. next: Generated, waiting to be activated
 * 2. active: Currently used for signing tokens
 * 3. previous: Recently rotated, still valid for verification
 * 4. retired: No longer valid for any operation
 */
export const rotateJwtKeysJob: Job = {
  name: 'rotate-jwt-keys',
  description: 'Rotate expired JWT signing keys',
  defaultCron: '0 0 * * *', // Daily at midnight

  async run(fastify: FastifyInstance): Promise<void> {
    const rotationEnabled = fastify.config.app.jwt_key_rotation_enabled ?? true;

    if (!rotationEnabled) {
      fastify.log.info('JWT key rotation is disabled in config, skipping job');
      return;
    }

    const rotated = await fastify.jwtKeyService.checkAndRotate();

    if (rotated) {
      fastify.log.info('JWT key rotation performed successfully');
    } else {
      fastify.log.debug('No JWT key rotation needed');
    }
  },
};
