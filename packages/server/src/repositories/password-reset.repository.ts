import { EntityRepository, ref } from '@mikro-orm/core';
import type { IPasswordResetEntity } from '../entities/password-reset.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';

export class PasswordResetRepository extends EntityRepository<IPasswordResetEntity> {
  /**
   * Generate and store a new password reset token
   * Invalidates all previous unused tokens for the user
   * @returns The created password reset entity with token
   */
  async generateToken(params: {
    userSub: string;
    userEpoch: string;
    expiresInHours?: number;
  }): Promise<IPasswordResetEntity> {
    // Generate a UUID token for security
    const token = crypto.randomUUID();

    // Calculate expiration time (default: 1 hour for security)
    const expiresInHours = params.expiresInHours || 1;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Invalidate all previous unused tokens for this user
    await this.nativeUpdate(
      { user: ref(UserEntity, params.userSub), used: false, revoked_at: null },
      { revoked_at: new Date() },
    );

    // Create the entity
    const entity = this.create({
      user: params.userSub,
      user_epoch: params.userEpoch,
      token,
      expiresAt,
    });

    // Persist to database
    this.getEntityManager().persist(entity);

    return entity;
  }

  /**
   * Verify a token and mark it as used
   * @returns The verified entity with user populated, or null if invalid
   */
  async verifyToken(token: string): Promise<IPasswordResetEntity | null> {
    const now = new Date();
    const changed = await this.nativeUpdate(
      { token, used: false, revoked_at: null, expiresAt: { $gt: now } },
      { used: true, usedAt: now },
    );
    if (changed !== 1) return null;
    return this.findOne({ token }, { populate: ['user'], refresh: true });
  }
}
