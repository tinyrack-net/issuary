import type { IUserTotpRecoveryCodeEntity } from '@backend/entities/user-totp-recovery-code.entity.js';
import { EntityRepository } from '@mikro-orm/core';

export class UserTotpRecoveryCodeRepository extends EntityRepository<IUserTotpRecoveryCodeEntity> {
  /**
   * Find all unused recovery codes for a user
   *
   * @param userId - User ID to lookup
   * @returns List of unused recovery code entities
   */
  async findUnusedByUserId(userId: string) {
    return this.find({ user: { id: userId }, used: false });
  }

  /**
   * Count unused recovery codes for a user
   *
   * @param userId - User ID to check
   * @returns Number of unused recovery codes
   */
  async countUnusedByUserId(userId: string) {
    return this.count({ user: { id: userId }, used: false });
  }

  /**
   * Delete all recovery codes for a user
   *
   * @param userId - User ID to delete recovery codes for
   * @returns Number of deleted records
   */
  async deleteByUserId(userId: string) {
    return this.nativeDelete({ user: { id: userId } });
  }
}
