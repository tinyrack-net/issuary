import { EntityRepository } from '@mikro-orm/core';
import { e } from '@/schemas/error.js';
import type { UserEntity } from '@/entities/user.entity.js';

export class UserRepository extends EntityRepository<UserEntity> {
  /**
   * Authenticate user with email and password
   *
   * @param params - Login credentials
   * @returns Authenticated user entity
   * @throws {InvalidEmailOrPassword} When email or password is incorrect
   */
  async login(params: { email: string; password: string }) {
    const err = new e.InvalidEmailOrPassword.Error();
    const user = await this.findOneOrFail(
      {
        email: params.email,
      },
      {
        populate: ['password_hash'],
        failHandler: () => err,
      },
    );

    if (await user.verifyPassword(params.password)) {
      return user;
    }
    throw err;
  }

  /**
   * Check if email is already registered
   *
   * @param email - Email address to check
   * @returns True if email exists, false otherwise
   */
  async exists(email: string) {
    const count = await this.count({ email: email });
    return count > 0;
  }

  /**
   * Register a new user
   *
   * @param params - Registration data
   * @returns Newly created user entity
   * @throws {EmailAlreadyExists} When email is already registered
   */
  async register(params: { email: string; password: string }) {
    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new e.EmailAlreadyExists.Error();
    }

    const user = this.create({
      email: params.email,
      password_hash: params.password,
    });

    await this.getEntityManager().persistAndFlush(user);
    return user;
  }
}
