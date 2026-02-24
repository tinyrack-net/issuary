import { EntityRepository, ref } from '@mikro-orm/core';
import type { IEmailVerificationEntity } from '#backend/entities/email-verification.entity.js';
import { UserEntity } from '#backend/entities/user.entity.js';

export class EmailVerificationRepository extends EntityRepository<IEmailVerificationEntity> {
  /**
   * Generate and store a new email verification token
   * @returns The created verification entity with token
   */
  async generateToken(params: {
    userSub: string;
    expiresInHours?: number;
  }): Promise<IEmailVerificationEntity> {
    const token = crypto.randomUUID();

    const expiresInHours = params.expiresInHours || 24;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const previousTokens = await this.find({
      user: ref(UserEntity, params.userSub),
      verified: false,
    });

    for (const prevToken of previousTokens) {
      prevToken.expiresAt = new Date(); // Expire immediately
    }

    const entity = this.create({
      user: params.userSub,
      token,
      expiresAt,
    });

    await this.getEntityManager().persist(entity);

    return entity;
  }

  /**
   * Verify a token and mark it as used
   * @returns The verified entity with user populated, or null if invalid
   */
  async verifyToken(token: string): Promise<IEmailVerificationEntity | null> {
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
}
