import fastifyPlugin from 'fastify-plugin';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
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
    emailVerificationService?: EmailVerificationService;
  }
}

export class EmailVerificationService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: ResolvedAppConfig,
  ) {}

  /**
   * Generate email verification token for a user
   * Invalidates all previous unverified tokens
   */
  public async generateToken(params: {
    userId: string;
    expiresInHours?: number;
  }): Promise<EmailVerificationEntity> {
    const token = await this.mikro.emailVerification.generateToken({
      userId: params.userId,
      expiresInHours: params.expiresInHours || 24,
    });
    return token;
  }

  /**
   * Verify email with token
   * Marks user's email as verified
   */
  public async verifyEmail(token: string): Promise<UserEntity> {
    const verification = await this.mikro.emailVerification.verifyToken(token);
    if (!verification) {
      throw new e.InvalidVerificationToken.Error();
    }
    const user = await verification.user.load();
    if (!user) {
      throw new e.UserNotFound.Error();
    }
    user.email_verified = true;
    await this.mikro.em.flush();
    return user;
  }

  /**
   * Resend verification email
   * Generates new token and sends email
   */
  public async resendVerification(
    email: string,
  ): Promise<EmailVerificationEntity> {
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );
    if (user.email_verified) {
      throw new e.EmailAlreadyVerified.Error();
    }
    const token = await this.generateToken({ userId: user.id });
    await this.mikro.em.flush();
    return token;
  }

  /**
   * Check if user has pending verification
   */
  public async hasPendingVerification(userId: string): Promise<boolean> {
    const count = await this.mikro.emailVerification.count({
      user: { id: userId },
      verified: false,
      expiresAt: { $gt: new Date() },
    });
    return count > 0;
  }

  /**
   * Remove expired email verification tokens.
   *
   * Expired tokens are no longer valid and can be safely deleted.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  public async cleanupExpired(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.email_verifications;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
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

    if (options.dryRun) {
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
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const service = new EmailVerificationService(fastify.mikro, fastify.config);
    fastify.decorate('emailVerificationService', service);
  },
  {
    name: 'email-verification-service-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
