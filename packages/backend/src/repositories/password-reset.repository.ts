import type { IPasswordResetEntity } from '@backend/entities/password-reset.entity.js';
import { UserEntity } from '@backend/entities/user.entity.js';
import { EntityRepository, ref } from '@mikro-orm/core';

export class PasswordResetRepository extends EntityRepository<IPasswordResetEntity> {
  /**
   * Generate and store a new password reset token
   * Invalidates all previous unused tokens for the user
   * @returns The created password reset entity with token
   */
  async generateToken(params: {
    userId: string;
    expiresInHours?: number;
  }): Promise<IPasswordResetEntity> {
    // Generate a UUID token for security
    const token = crypto.randomUUID();

    // Calculate expiration time (default: 1 hour for security)
    const expiresInHours = params.expiresInHours || 1;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Invalidate all previous unused tokens for this user
    const previousTokens = await this.find({
      user: ref(UserEntity, params.userId),
      used: false,
    });

    for (const prevToken of previousTokens) {
      prevToken.expiresAt = new Date(); // Expire immediately
    }

    // Create the entity
    const entity = this.create({
      user: params.userId,
      token,
      expiresAt,
    });

    // Persist to database
    await this.getEntityManager().persist(entity);

    return entity;
  }

  /**
   * Verify a token and mark it as used
   * @returns The verified entity with user populated, or null if invalid
   */
  async verifyToken(token: string): Promise<IPasswordResetEntity | null> {
    const entity = await this.findOne(
      { token, used: false },
      { populate: ['user'] },
    );

    if (!entity) {
      return null;
    }

    // Check if expired
    if (entity.expiresAt < new Date()) {
      return null;
    }

    // Mark as used
    entity.used = true;
    entity.usedAt = new Date();

    await this.getEntityManager().flush();

    return entity;
  }

  /**
   * Find a valid (unexpired, unused) token
   * @returns The token entity with user populated, or null if not found
   */
  async findValidToken(token: string): Promise<IPasswordResetEntity | null> {
    const entity = await this.findOne(
      { token, used: false },
      { populate: ['user'] },
    );

    if (!entity) {
      return null;
    }

    // Check if expired
    if (entity.expiresAt < new Date()) {
      return null;
    }

    return entity;
  }

  /**
   * Clean up expired tokens (for maintenance/cron jobs)
   */
  async cleanExpiredTokens(): Promise<number> {
    const result = await this.nativeDelete({
      expiresAt: { $lt: new Date() },
      used: false,
    });

    return result;
  }
}
