import type { CleanupContext, CleanupResult, CleanupTask } from './types.js';

/**
 * JWT Keys Rotation Task
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
export const jwtKeysTask: CleanupTask = {
  name: 'jwt-keys',
  description: 'Rotate expired JWT signing keys',

  async run(ctx: CleanupContext): Promise<CleanupResult> {
    const config = ctx.fastify.config.cleanup.jwt_keys;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Check if JWT key rotation is enabled in app config
    const rotationEnabled =
      ctx.fastify.config.app.jwt_key_rotation_enabled ?? true;

    if (!rotationEnabled) {
      return {
        deletedCount: 0,
        skipped: true,
        message: 'JWT key rotation is disabled in app config',
      };
    }

    if (ctx.dryRun) {
      // Check if rotation would be needed
      const expiredKeys = await ctx.fastify.mikro.jwtKey.getExpiredActiveKeys();
      if (expiredKeys.length > 0) {
        return {
          deletedCount: expiredKeys.length,
          skipped: false,
          message: `Would rotate ${expiredKeys.length} expired key(s)`,
        };
      }
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No rotation needed',
      };
    }

    const rotated = await ctx.fastify.jwtKeyService.checkAndRotate();

    if (rotated) {
      return {
        deletedCount: 1,
        skipped: false,
        message: 'Key rotation performed',
      };
    }

    return {
      deletedCount: 0,
      skipped: false,
      message: 'No rotation needed',
    };
  },
};
