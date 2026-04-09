import { EntityRepository } from '@mikro-orm/core';
import type { IUserPasskeyEntity } from '../entities/user-passkey.entity.ts';

export class UserPasskeyRepository extends EntityRepository<IUserPasskeyEntity> {
  /**
   * Find all passkeys for a user
   *
   * @param userSub - User sub to lookup
   * @returns Array of passkey entities
   */
  async findByUserSub(userSub: string) {
    return this.find(
      { user: { sub: userSub } },
      { orderBy: { created_at: 'DESC' } },
    );
  }

  /**
   * Find a passkey by credential ID
   *
   * @param credentialId - WebAuthn credential ID (base64url encoded)
   * @returns Passkey entity or null if not found
   */
  async findByCredentialId(credentialId: string) {
    return this.findOne(
      { credential_id: credentialId },
      { populate: ['user', 'public_key'] },
    );
  }

  /**
   * Find a passkey by ID and user sub
   *
   * @param userSub - User sub
   * @param passkeyId - Passkey ID
   * @returns Passkey entity or null if not found
   */
  async findByUserSubAndId(userSub: string, passkeyId: string) {
    return this.findOne({ user: { sub: userSub }, id: passkeyId });
  }

  /**
   * Count passkeys for a user
   *
   * @param userSub - User sub to count passkeys for
   * @returns Number of passkeys
   */
  async countByUserSub(userSub: string) {
    return this.count({ user: { sub: userSub } });
  }

  /**
   * Delete a passkey by user sub and passkey ID
   *
   * @param userSub - User sub
   * @param passkeyId - Passkey ID
   * @returns Number of deleted records
   */
  async deleteByUserSubAndId(userSub: string, passkeyId: string) {
    return this.nativeDelete({ user: { sub: userSub }, id: passkeyId });
  }

  /**
   * Check if a credential ID already exists
   *
   * @param credentialId - WebAuthn credential ID to check
   * @returns True if the credential ID exists
   */
  async existsByCredentialId(credentialId: string) {
    const count = await this.count({ credential_id: credentialId });
    return count > 0;
  }
}
