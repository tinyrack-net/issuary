import type { UserEntity } from '@/entities/user.entity.js';
import { e } from '@/schemas/error.js';
import { EntityRepository, type Loaded } from '@mikro-orm/core';

export class UserRepository extends EntityRepository<UserEntity> {
  public async verifyById(
    id: string,
  ): Promise<
    Loaded<UserEntity, 'password_hash' | 'passkeys' | 'totps', '*', never>
  > {
    const user = await this.findOneOrFail(
      {
        id: id,
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

  async verifyByEmailAndPassword(params: { email: string; password: string }) {
    const err = new e.InvalidEmailOrPassword.Error();
    const user = await this.findOneOrFail(
      {
        email: params.email,
        deleted_at: null, // Only allow non-deleted users
      },
      {
        populate: ['password_hash', 'totps', 'passkeys'],
        populateWhere: {
          totps: { verified: true },
          passkeys: {},
        },
        failHandler: () => err,
      },
    );

    if (await user.verifyPassword(params.password)) {
      return user;
    }
    throw err;
  }

  /**
   * Check if email is already registered (excluding deleted users)
   *
   * @param email - Email address to check
   * @returns True if email exists and is not deleted, false otherwise
   */
  async exists(email: string) {
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
  async register(params: { email: string; password: string }) {
    const emailExists = await this.exists(params.email);
    if (emailExists) {
      throw new e.EmailAlreadyExists.Error();
    }
    const user = this.create({
      email: params.email,
      password_hash: params.password,
    });
    await this.getEntityManager().persist(user).flush();
    return user;
  }

  /**
   * Check if user is deleted
   *
   * @param userId - User ID to check
   * @returns True if user is deleted
   */
  async isDeleted(userId: string): Promise<boolean> {
    const user = await this.findOne({ id: userId });
    return user?.deleted_at !== null;
  }

  /**
   * Soft delete a user by setting deleted_at
   *
   * @param userId - User ID to delete
   * @returns The updated user entity
   * @throws {UserNotFound} When user is not found
   */
  async softDelete(userId: string): Promise<UserEntity> {
    const user = await this.findOneOrFail(
      { id: userId, deleted_at: null },
      { failHandler: () => new e.UserNotFound.Error() },
    );
    user.deleted_at = new Date();
    await this.getEntityManager().flush();
    return user;
  }
}
