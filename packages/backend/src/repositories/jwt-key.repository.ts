import { EntityRepository } from '@mikro-orm/core';
import {
  type JwtKeyEntity,
  JwtKeyStatus,
} from '#backend/entities/jwt-key.entity.js';

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
}
