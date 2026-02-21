import type { IUserTotpRecoveryCodeEntity } from '@backend/entities/user-totp-recovery-code.entity.js';
import { EntityRepository } from '@mikro-orm/core';

export class UserTotpRecoveryCodeRepository extends EntityRepository<IUserTotpRecoveryCodeEntity> {
  /**
   * Find all unused recovery codes for a user
   *
   * @param userSub - User sub to lookup
   * @returns List of unused recovery code entities
   */
  async findUnusedByUserSub(userSub: string) {
    return this.find({ user: { sub: userSub }, used: false });
  }

  /**
   * Count unused recovery codes for a user
   *
   * @param userSub - User sub to check
   * @returns Number of unused recovery codes
   */
  async countUnusedByUserSub(userSub: string) {
    return this.count({ user: { sub: userSub }, used: false });
  }

  /**
   * Delete all recovery codes for a user
   *
   * @param userSub - User sub to delete recovery codes for
   * @returns Number of deleted records
   */
  async deleteByUserSub(userSub: string) {
    return this.nativeDelete({ user: { sub: userSub } });
  }
}
