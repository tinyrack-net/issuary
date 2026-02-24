import { EntityRepository } from '@mikro-orm/core';
import type { IUserTotpEntity } from '#backend/entities/user-totp.entity.js';

export class UserTotpRepository extends EntityRepository<IUserTotpEntity> {
  /**
   * Find TOTP configuration by user sub
   *
   * @param userSub - User sub to lookup
   * @returns TOTP entity or null if not found
   */
  async findByUserSub(userSub: string) {
    return this.findOne({ user: { sub: userSub } }, { populate: ['secret'] });
  }

  /**
   * Find fully registered TOTP configuration by user sub
   * (verified AND recovery codes confirmed)
   *
   * @param userSub - User sub to lookup
   * @returns Fully registered TOTP entity or null if not found
   */
  async findFullyRegisteredByUserSub(userSub: string) {
    return this.findOne(
      { user: { sub: userSub }, verified: true, recovery_confirmed: true },
      { populate: ['secret'] },
    );
  }

  /**
   * Find verified TOTP configuration by user sub
   * (verified but may not have recovery codes confirmed)
   *
   * @param userSub - User sub to lookup
   * @returns Verified TOTP entity or null if not found
   */
  async findVerifiedByUserSub(userSub: string) {
    return this.findOne(
      { user: { sub: userSub }, verified: true },
      { populate: ['secret'] },
    );
  }

  /**
   * Check if user has TOTP fully enabled (verified AND recovery confirmed)
   *
   * @param userSub - User sub to check
   * @returns True if TOTP is fully enabled for user
   */
  async isRegistered(userSub: string) {
    const count = await this.count({
      user: { sub: userSub },
      verified: true,
      recovery_confirmed: true,
    });
    return count > 0;
  }

  /**
   * Delete TOTP configuration for a user
   *
   * @param userSub - User sub to delete TOTP for
   * @returns Number of deleted records
   */
  async deleteByUserSub(userSub: string) {
    return this.nativeDelete({ user: { sub: userSub } });
  }
}
