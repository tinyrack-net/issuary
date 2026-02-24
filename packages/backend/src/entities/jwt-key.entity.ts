import { JwtKeyRepository } from '@backend/repositories/jwt-key.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';

/**
 * JWT Key status for rotation lifecycle
 *
 * - next: Key is generated but not yet active (pre-rotation)
 * - active: Currently used for signing tokens
 * - previous: Recently rotated out, still valid for verification
 * - retired: No longer valid for any operation
 */
export enum JwtKeyStatus {
  /** Generated but not yet active */
  NEXT = 'next',
  /** Currently used for signing */
  ACTIVE = 'active',
  /** Recently rotated, still valid for verification */
  PREVIOUS = 'previous',
  /** No longer valid */
  RETIRED = 'retired',
}

/**
 * JWT Key Entity for asymmetric key management (RS256)
 *
 * Stores RSA key pairs for JWT signing and verification.
 * Supports key rotation with multiple active keys for seamless transitions.
 *
 * Security notes:
 * - Private keys are stored in PEM format
 * - In production, consider encrypting private_key column at rest
 * - Only 'active' keys are used for signing
 * - 'active' and 'previous' keys are used for verification
 * - 'previous' keys are exposed in JWKS for token verification
 */
export const JwtKeyEntitySchema = defineEntity({
  name: 'JwtKeyEntity',
  tableName: 'jwt_key',
  comment: 'RSA key pairs for JWT signing (RS256)',
  extends: BaseSchema,
  repository: () => JwtKeyRepository,
  properties: (p) => ({
    /**
     * Key ID (kid) - unique identifier for JWT header
     * Format: "key-{timestamp}-{random}"
     */
    kid: p.string().primary().comment('Key ID for JWT header (kid claim)'),

    /**
     * RSA Private Key in PEM format
     * Used for signing tokens (only when status is 'active')
     */
    private_key: p
      .text()
      .comment('RSA private key in PEM format')
      .lazy()
      .hidden(),

    /**
     * RSA Public Key in PEM format
     * Used for token verification and exposed via JWKS endpoint
     */
    public_key: p.text().comment('RSA public key in PEM format'),

    /**
     * JWT signing algorithm
     */
    algorithm: p
      .string()
      .comment('JWT signing algorithm (RS256)')
      .default('RS256'),

    /**
     * Key status in rotation lifecycle
     */
    status: p
      .enum(() => JwtKeyStatus)
      .comment('Key status: next, active, previous, retired')
      .default(JwtKeyStatus.NEXT),

    /**
     * Timestamp when key was activated (started signing)
     */
    activated_at: p
      .datetime()
      .comment('When the key was activated for signing')
      .nullable()
      .default(null),

    /**
     * Timestamp when key was deactivated (stopped signing)
     */
    deactivated_at: p
      .datetime()
      .comment('When the key was deactivated from signing')
      .nullable()
      .default(null),

    /**
     * Timestamp when key was retired (no longer valid)
     */
    retired_at: p
      .datetime()
      .comment('When the key was fully retired')
      .nullable()
      .default(null),

    /**
     * Scheduled expiration date for automatic rotation
     */
    expires_at: p
      .datetime()
      .comment('Scheduled expiration for automatic rotation')
      .nullable()
      .default(null),
  }),
  indexes: [
    {
      name: 'jwt_key_status_idx',
      properties: ['status'],
    },
  ],
});

export type IJwtKeyEntity = InferEntity<typeof JwtKeyEntitySchema>;

export class JwtKeyEntity extends JwtKeyEntitySchema.class {
  /**
   * Check if key can be used for verification
   */
  isVerificationKey(): boolean {
    return (
      this.status === JwtKeyStatus.ACTIVE ||
      this.status === JwtKeyStatus.PREVIOUS
    );
  }
}

JwtKeyEntitySchema.setClass(JwtKeyEntity);
