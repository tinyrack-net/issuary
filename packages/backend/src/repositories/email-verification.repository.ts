import { EntityRepository } from '@mikro-orm/core';
import type { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import type { UserEntity } from '@/entities/user.entity.js';

export class EmailVerificationRepository extends EntityRepository<EmailVerificationEntity> {
  /**
   * Generate and store a new email verification token
   * @returns The created verification entity with token
   */
  async generateToken(params: {
    user: UserEntity;
    expiresInHours?: number;
  }): Promise<EmailVerificationEntity> {
    // Generate a UUID token for security
    const token = crypto.randomUUID();

    // Calculate expiration time (default: 24 hours)
    const expiresInHours = params.expiresInHours || 24;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Invalidate all previous unverified tokens for this user
    const previousTokens = await this.find({
      user: params.user,
      verified: false,
    });

    for (const prevToken of previousTokens) {
      prevToken.expiresAt = new Date(); // Expire immediately
    }

    // Create the entity
    const entity = this.create({
      user: params.user,
      token,
      expiresAt,
      verified: false,
    });

    // Persist to database
    await this.getEntityManager().persistAndFlush(entity);

    return entity;
  }

  /**
   * Verify a token and mark it as used
   * @returns The verified entity with user populated, or null if invalid
   */
  async verifyToken(token: string): Promise<EmailVerificationEntity | null> {
    const entity = await this.findOne(
      { token, verified: false },
      { populate: ['user'] },
    );

    if (!entity) {
      return null;
    }

    // Check if expired
    if (entity.expiresAt < new Date()) {
      return null;
    }

    // Mark as verified
    entity.verified = true;
    entity.verifiedAt = new Date();

    await this.getEntityManager().flush();

    return entity;
  }

  /**
   * Clean up expired tokens (for maintenance/cron jobs)
   */
  async cleanExpiredTokens(): Promise<number> {
    const result = await this.nativeDelete({
      expiresAt: { $lt: new Date() },
      verified: false,
    });

    return result;
  }
}
