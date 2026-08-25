import { EntityRepository } from '@mikro-orm/core';
import type { IUserTotpRecoveryCodeEntity } from '../entities/user-totp-recovery-code.entity.ts';

export class UserTotpRecoveryCodeRepository extends EntityRepository<IUserTotpRecoveryCodeEntity> {
  async findUnusedByUserSubAndCodeHash(
    userSub: string,
    codeHash: string | string[],
  ) {
    const codeHashes = Array.isArray(codeHash) ? codeHash : [codeHash];
    return this.findOne({
      user: { sub: userSub },
      code_hash: { $in: codeHashes },
      used: false,
    });
  }

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

  async countByUserSub(userSub: string) {
    return this.count({ user: { sub: userSub } });
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
