import { EntityRepository } from '@mikro-orm/core';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';

/**
 * Repository for JWT Key management
 *
 * Handles CRUD operations and queries for RSA key pairs
 * used in JWT signing and verification.
 */
export class JwtKeyRepository extends EntityRepository<JwtKeyEntity> {
  /**
   * Get the currently active signing key
   *
   * @returns Active key with private_key loaded, or null if none exists
   */
  async getActiveKey(): Promise<JwtKeyEntity | null> {
    return this.findOne(
      { status: JwtKeyStatus.ACTIVE },
      { populate: ['private_key'] },
    );
  }

  /**
   * Get all keys valid for token verification (active + previous)
   *
   * @returns Array of keys that can verify tokens
   */
  async getVerificationKeys(): Promise<JwtKeyEntity[]> {
    return this.find({
      status: { $in: [JwtKeyStatus.ACTIVE, JwtKeyStatus.PREVIOUS] },
    });
  }

  /**
   * Get all keys to expose in JWKS endpoint (public keys only)
   *
   * @returns Array of active and previous keys for JWKS
   */
  async getPublicKeys(): Promise<JwtKeyEntity[]> {
    return this.find(
      {
        status: { $in: [JwtKeyStatus.ACTIVE, JwtKeyStatus.PREVIOUS] },
      },
      {
        fields: ['kid', 'public_key', 'algorithm', 'status'],
        orderBy: { created_at: 'DESC' },
      },
    );
  }

  /**
   * Get key by kid for verification
   *
   * @param kid - Key ID from JWT header
   * @returns Key entity or null
   */
  async getByKid(kid: string): Promise<JwtKeyEntity | null> {
    return this.findOne({ kid });
  }

  /**
   * Get key by kid with private key for signing
   *
   * @param kid - Key ID
   * @returns Key entity with private_key populated, or null
   */
  async getByKidWithPrivateKey(kid: string): Promise<JwtKeyEntity | null> {
    return this.findOne({ kid }, { populate: ['private_key'] });
  }

  /**
   * Get the next key waiting to be activated
   *
   * @returns Next key or null
   */
  async getNextKey(): Promise<JwtKeyEntity | null> {
    return this.findOne(
      { status: JwtKeyStatus.NEXT },
      { populate: ['private_key'] },
    );
  }

  /**
   * Get all previous (recently rotated) keys
   *
   * @returns Array of previous keys
   */
  async getPreviousKeys(): Promise<JwtKeyEntity[]> {
    return this.find({ status: JwtKeyStatus.PREVIOUS });
  }

  /**
   * Get keys that should be retired (past overlap period)
   *
   * @param overlapDays - Number of days to keep previous keys
   * @returns Keys that should be retired
   */
  async getKeysToRetire(overlapDays: number): Promise<JwtKeyEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overlapDays);

    return this.find({
      status: JwtKeyStatus.PREVIOUS,
      deactivated_at: { $lt: cutoffDate },
    });
  }

  /**
   * Get expired active keys that need rotation
   *
   * @returns Active keys past their expiration date
   */
  async getExpiredActiveKeys(): Promise<JwtKeyEntity[]> {
    const now = new Date();

    return this.find({
      status: JwtKeyStatus.ACTIVE,
      expires_at: { $lt: now },
    });
  }

  /**
   * Count keys by status
   *
   * @param status - Key status to count
   * @returns Number of keys with given status
   */
  async countByStatus(status: JwtKeyStatus): Promise<number> {
    return this.count({ status });
  }

  /**
   * Check if any active key exists
   *
   * @returns True if at least one active key exists
   */
  async hasActiveKey(): Promise<boolean> {
    const count = await this.countByStatus(JwtKeyStatus.ACTIVE);
    return count > 0;
  }
}
