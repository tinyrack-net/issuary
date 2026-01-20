import { EntityRepository } from '@mikro-orm/core';
import type { UserTotpEntity } from '@/entities/user-totp.entity.js';

export class UserTotpRepository extends EntityRepository<UserTotpEntity> {
  /**
   * Find TOTP configuration by user ID
   *
   * @param userId - User ID to lookup
   * @returns TOTP entity or null if not found
   */
  async findByUserId(userId: string) {
    return this.findOne({ user: { id: userId } }, { populate: ['secret'] });
  }

  /**
   * Find verified TOTP configuration by user ID
   *
   * @param userId - User ID to lookup
   * @returns Verified TOTP entity or null if not found
   */
  async findVerifiedByUserId(userId: string) {
    return this.findOne(
      { user: { id: userId }, verified: true },
      { populate: ['secret'] },
    );
  }

  /**
   * Check if user has TOTP enabled (verified)
   *
   * @param userId - User ID to check
   * @returns True if TOTP is enabled for user
   */
  async isRegistered(userId: string) {
    const count = await this.count({ user: { id: userId }, verified: true });
    return count > 0;
  }

  /**
   * Delete TOTP configuration for a user
   *
   * @param userId - User ID to delete TOTP for
   * @returns Number of deleted records
   */
  async deleteByUserId(userId: string) {
    return this.nativeDelete({ user: { id: userId } });
  }
}
