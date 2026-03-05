import { EntityRepository, type Loaded } from '@mikro-orm/core';
import type { UserEntity } from '#backend/entities/user.entity.js';
import { e } from '#backend/schemas/error.js';

export class UserRepository extends EntityRepository<UserEntity> {
  /**
   * Find user by sub with no relation populate.
   * Use this for lightweight verification (e.g., middleware).
   * If you need related data (totps, passkeys, password_hash),
   * use verifyBySub() or populate the entity yourself.
   */
  public async findBySub(sub: string): Promise<UserEntity> {
    const user = await this.findOneOrFail(
      { sub },
      { failHandler: () => new e.UserNotFound.Error() },
    );
    return user;
  }

  public async verifyBySub(
    sub: string,
  ): Promise<
    Loaded<UserEntity, 'password_hash' | 'passkeys' | 'totps', '*', never>
  > {
    const user = await this.findOneOrFail(
      {
        sub: sub,
      },
      {
        populate: ['password_hash', 'totps', 'passkeys'],
        populateWhere: {
          totps: { verified: true },
          passkeys: {},
        },
        failHandler: () => new e.UserNotFound.Error(),
      },
    );
    return user;
  }

  public async findActiveByEmailForPasswordAuth(
    email: string,
  ): Promise<
    Loaded<UserEntity, 'password_hash' | 'passkeys' | 'totps', '*', never>
  > {
    return this.findOneOrFail(
      {
        email,
        deleted_at: null,
      },
      {
        populate: ['password_hash', 'totps', 'passkeys'],
        populateWhere: {
          totps: { verified: true },
          passkeys: {},
        },
        failHandler: () => new e.InvalidEmailOrPassword.Error(),
      },
    );
  }

  /**
   * Check if email is already registered (excluding deleted users)
   *
   * @param email - Email address to check
   * @returns True if email exists and is not deleted, false otherwise
   */
  public async exists(email: string) {
    const count = await this.count({ email: email, deleted_at: null });
    return count > 0;
  }

  /**
   * Register a new user
   *
   * @param params - Registration data
   * @returns Newly created user entity
   * @throws {EmailAlreadyExists} When email is already registered
   */
  public async register(params: { email: string; passwordHash: string }) {
    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new e.EmailAlreadyExists.Error();
    }
    const user = this.create({
      email: params.email,
      password_hash: params.passwordHash,
    });
    await this.getEntityManager().persist(user).flush();
    return user;
  }
}
