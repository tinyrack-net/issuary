import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import type { JwtKeyRepository } from '@/repositories/jwt-key.repository.js';
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

    // Fork EntityManager for CLI context isolation
    const em = ctx.fastify.mikro.orm.em.fork();
    const jwtKeyRepo = em.getRepository(JwtKeyEntity) as JwtKeyRepository;

    // Check for expired active keys
    const now = new Date();
    const expiredKeys = await jwtKeyRepo.find({
      status: JwtKeyStatus.ACTIVE,
      expires_at: { $lt: now },
    });

    if (ctx.dryRun) {
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

    if (expiredKeys.length === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No rotation needed',
      };
    }

    // Perform rotation using forked EM
    // 1. Deactivate expired active keys -> previous
    for (const key of expiredKeys) {
      key.status = JwtKeyStatus.PREVIOUS;
      key.deactivated_at = new Date();
    }

    // 2. Check for next key to promote, or create new one
    let nextKey = await jwtKeyRepo.findOne(
      { status: JwtKeyStatus.NEXT },
      { populate: ['private_key'] },
    );

    if (!nextKey) {
      // Generate new key using the service (still uses global EM for key generation)
      // This is acceptable because key generation doesn't query existing entities
      const keyPair = await ctx.fastify.jwtKeyService.generateKeyPair();
      const rotationDays = ctx.fastify.config.app.jwt_key_rotation_days ?? 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rotationDays);

      nextKey = em.create(JwtKeyEntity, {
        kid: keyPair.kid,
        private_key: keyPair.privateKey,
        public_key: keyPair.publicKey,
        algorithm: keyPair.algorithm,
        status: JwtKeyStatus.NEXT,
        expires_at: expiresAt,
      });
    }

    // 3. Activate the next key
    nextKey.status = JwtKeyStatus.ACTIVE;
    nextKey.activated_at = new Date();

    // 4. Retire old previous keys past overlap period
    const overlapDays = ctx.fastify.config.app.jwt_key_overlap_days ?? 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overlapDays);

    const keysToRetire = await jwtKeyRepo.find({
      status: JwtKeyStatus.PREVIOUS,
      deactivated_at: { $lt: cutoffDate },
    });

    for (const key of keysToRetire) {
      key.status = JwtKeyStatus.RETIRED;
      key.retired_at = new Date();
    }

    await em.flush();

    // Clear service cache after rotation
    ctx.fastify.jwtKeyService.clearActiveKeyCache();

    return {
      deletedCount: 1,
      skipped: false,
      message: `Key rotation performed${keysToRetire.length > 0 ? `, ${keysToRetire.length} key(s) retired` : ''}`,
    };
  },
};
