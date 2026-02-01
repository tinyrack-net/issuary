import fastifyPlugin from 'fastify-plugin';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';
import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/core/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { CleanupOptions, CleanupResult } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    passwordResetService: PasswordResetService;
  }
}

export class PasswordResetService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: ResolvedAppConfig,
  ) {}

  /**
   * Generate password reset token for a user
   * Invalidates all previous unused tokens
   */
  async generateToken(params: {
    userId: string;
    expiresInHours?: number;
  }): Promise<PasswordResetEntity> {
    const token = await this.mikro.passwordReset.generateToken({
      userId: params.userId,
      expiresInHours: params.expiresInHours || 1,
    });

    return token;
  }

  /**
   * Request password reset for an email
   * Returns token entity if user exists and is database-managed
   */
  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetEntity | null> {
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    if (user.managed_by !== 'database') {
      throw new e.UserNotEditable.Error();
    }

    const token = await this.generateToken({ userId: user.id });
    await this.mikro.em.flush();

    return token;
  }

  /**
   * Reset password with token
   * Verifies token and updates user password
   */
  async resetPassword(params: {
    token: string;
    password: string;
  }): Promise<UserEntity> {
    const resetEntity = await this.mikro.passwordReset.verifyToken(
      params.token,
    );

    if (!resetEntity) {
      throw new e.InvalidPasswordResetToken.Error();
    }

    const user = await resetEntity.user.loadOrFail({
      failHandler: () => new e.UserNotFound.Error(),
    });

    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    user.password_hash = params.password;
    await this.mikro.em.flush();

    return user;
  }

  /**
   * Validate a password reset token without using it
   */
  async validateToken(token: string): Promise<boolean> {
    const entity = await this.mikro.passwordReset.findValidToken(token);
    return entity !== null;
  }

  /**
   * Remove expired password reset tokens.
   *
   * Expired tokens are no longer valid and can be safely deleted.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupExpired(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.password_resets;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const passwordResetRepo = em.getRepository(PasswordResetEntity);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Count expired tokens before the cutoff date
    const count = await passwordResetRepo.count({
      expiresAt: { $lt: cutoffDate },
      used: false,
    });

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (options.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Use native delete for efficiency
    const deletedCount = await passwordResetRepo.nativeDelete({
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
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const service = new PasswordResetService(fastify.mikro, fastify.config);
    fastify.decorate('passwordResetService', service);
  },
  {
    name: 'password-reset-service-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
