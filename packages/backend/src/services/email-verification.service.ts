import fastifyPlugin from 'fastify-plugin';
import type { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';

declare module 'fastify' {
  interface FastifyInstance {
    emailVerificationService: EmailVerificationService;
  }
}

export class EmailVerificationService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * Generate email verification token for a user
   * Invalidates all previous unverified tokens
   */
  async generateToken(params: {
    user: UserEntity;
    expiresInHours?: number;
  }): Promise<EmailVerificationEntity> {
    const token = await this.mikro.emailVerification.generateToken({
      user: params.user,
      expiresInHours: params.expiresInHours || 24,
    });

    return token;
  }

  /**
   * Verify email with token
   * Marks user's email as verified
   */
  async verifyEmail(token: string): Promise<UserEntity> {
    const verification = await this.mikro.emailVerification.verifyToken(token);

    if (!verification) {
      throw new e.InvalidVerificationToken.Error();
    }

    // Mark user's email as verified
    verification.user.email_verified = true;
    await this.mikro.em.flush();

    return verification.user;
  }

  /**
   * Resend verification email
   * Generates new token and sends email
   */
  async resendVerification(email: string): Promise<EmailVerificationEntity> {
    const user = await this.mikro.user.findOneOrFail(
      { email },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    if (user.email_verified) {
      throw new e.EmailAlreadyVerified.Error();
    }

    // Generate new token (this invalidates old ones)
    const token = await this.generateToken({ user });

    // Ensure changes are persisted
    await this.mikro.em.flush();

    return token;
  }

  /**
   * Check if user has pending verification
   */
  async hasPendingVerification(userId: string): Promise<boolean> {
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
    const service = new EmailVerificationService(fastify.mikro);
    fastify.decorate('emailVerificationService', service);
  },
  {
    name: 'email-verification-service-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
