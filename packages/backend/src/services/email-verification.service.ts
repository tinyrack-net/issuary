import fastifyPlugin from 'fastify-plugin';
import type { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/core/mikro-orm.js';
import { e } from '@/schemas/error.js';

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
