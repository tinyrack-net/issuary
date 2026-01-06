import { EntityRepository } from '@mikro-orm/core';
import type { UserEntity } from '@/entities/user.entity.js';

export class UserRepository extends EntityRepository<UserEntity> {

  async login(params: { email: string; password: string }) {
    const err = new Error('Invalid combination of email and password');
    const user = await this.findOneOrFail({
      email: params.email,
    }, {
      populate: ['password_hash'],
      failHandler: () => err,
    });

    if (await user.verifyPassword(params.password)) {
      return user;
    }
    throw err;
  }

  async exists(email: string) {
    const count = await this.count({ email: email });
    return count > 0;
  }
}
