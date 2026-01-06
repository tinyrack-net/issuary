import { EntityRepository } from '@mikro-orm/core';
import type { UserEntity } from '@/entities/user.entity.js';

export class UserRepository extends EntityRepository<UserEntity> {
  async exists(email: string) {
    const count = await this.count({ email: email });
    return count > 0;
  }
}
