import { EntityRepository } from '@mikro-orm/core';
import type { UserPasskeyEntity } from '@/entities/user-passkey.entity.js';

export class UserPasskeyRepository extends EntityRepository<UserPasskeyEntity> {
  /**
   * Find all passkeys for a user
   *
   * @param userId - User ID to lookup
   * @returns Array of passkey entities
   */
  async findByUserId(userId: string) {
    return this.find(
      { user: { id: userId } },
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
   * Find a passkey by ID and user ID
   *
   * @param userId - User ID
   * @param passkeyId - Passkey ID
   * @returns Passkey entity or null if not found
   */
  async findByUserIdAndId(userId: string, passkeyId: string) {
    return this.findOne({ user: { id: userId }, id: passkeyId });
  }

  /**
   * Count passkeys for a user
   *
   * @param userId - User ID to count passkeys for
   * @returns Number of passkeys
   */
  async countByUserId(userId: string) {
    return this.count({ user: { id: userId } });
  }

  /**
   * Delete a passkey by user ID and passkey ID
   *
   * @param userId - User ID
   * @param passkeyId - Passkey ID
   * @returns Number of deleted records
   */
  async deleteByUserIdAndId(userId: string, passkeyId: string) {
    return this.nativeDelete({ user: { id: userId }, id: passkeyId });
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
