import { EntityRepository, ref } from '@mikro-orm/core';
import type { IEmailVerificationEntity } from '../entities/email-verification.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';

export class EmailVerificationRepository extends EntityRepository<IEmailVerificationEntity> {
  /**
   * Generate and store a new email verification token
   * @returns The created verification entity with token
   */
  async generateToken(params: {
    userSub: string;
    userEpoch: string;
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
      user_epoch: params.userEpoch,
      token,
      expiresAt,
    });

    this.getEntityManager().persist(entity);

    return entity;
  }

  /**
   * Verify a token and mark it as used
   * @returns The verified entity with user populated, or null if invalid
   */
  async verifyToken(token: string): Promise<IEmailVerificationEntity | null> {
    const now = new Date();
    const changed = await this.nativeUpdate(
      { token, verified: false, expiresAt: { $gt: now } },
      { verified: true, verifiedAt: now },
    );
    if (changed !== 1) return null;
    return this.findOne({ token }, { populate: ['user'], refresh: true });
  }
}
