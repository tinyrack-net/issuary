import {
  Entity,
  EntityRepositoryType,
  Enum,
  Index,
  type Opt,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { JwtKeyRepository } from '@/repositories/jwt-key.repository.js';
import { BaseEntity } from './base.entity.js';

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
@Entity({
  tableName: 'jwt_key',
  comment: 'RSA key pairs for JWT signing (RS256)',
  repository: () => JwtKeyRepository,
})
export class JwtKeyEntity extends BaseEntity<'kid'> {
  [EntityRepositoryType]?: JwtKeyRepository;

  /**
   * Key ID (kid) - unique identifier for JWT header
   * Format: "key-{timestamp}-{random}"
   */
  @PrimaryKey({
    type: t.string,
    name: 'kid',
    comment: 'Key ID for JWT header (kid claim)',
    nullable: false,
  })
  public kid: string;

  /**
   * RSA Private Key in PEM format
   * Used for signing tokens (only when status is 'active')
   */
  @Property({
    type: t.text,
    name: 'private_key',
    comment: 'RSA private key in PEM format',
    nullable: false,
    lazy: true,
    hidden: true,
  })
  public private_key: string;

  /**
   * RSA Public Key in PEM format
   * Used for token verification and exposed via JWKS endpoint
   */
  @Property({
    type: t.text,
    name: 'public_key',
    comment: 'RSA public key in PEM format',
    nullable: false,
  })
  public public_key: string;

  /**
   * JWT signing algorithm
   */
  @Property({
    type: t.string,
    name: 'algorithm',
    comment: 'JWT signing algorithm (RS256)',
    nullable: false,
    default: 'RS256',
  })
  public algorithm: Opt<string> = 'RS256';

  /**
   * Key status in rotation lifecycle
   */
  @Index({
    name: 'jwt_key_status_idx',
    properties: ['status'],
  })
  @Enum({
    items: () => JwtKeyStatus,
    name: 'status',
    comment: 'Key status: next, active, previous, retired',
    nullable: false,
    default: JwtKeyStatus.NEXT,
  })
  public status: Opt<JwtKeyStatus> = JwtKeyStatus.NEXT;

  /**
   * Timestamp when key was activated (started signing)
   */
  @Property({
    type: t.datetime,
    name: 'activated_at',
    comment: 'When the key was activated for signing',
    nullable: true,
  })
  public activated_at?: Date | null = null;

  /**
   * Timestamp when key was deactivated (stopped signing)
   */
  @Property({
    type: t.datetime,
    name: 'deactivated_at',
    comment: 'When the key was deactivated from signing',
    nullable: true,
  })
  public deactivated_at?: Date | null = null;

  /**
   * Timestamp when key was retired (no longer valid)
   */
  @Property({
    type: t.datetime,
    name: 'retired_at',
    comment: 'When the key was fully retired',
    nullable: true,
  })
  public retired_at?: Date | null = null;

  /**
   * Scheduled expiration date for automatic rotation
   */
  @Property({
    type: t.datetime,
    name: 'expires_at',
    comment: 'Scheduled expiration for automatic rotation',
    nullable: true,
  })
  public expires_at?: Date | null = null;

  public constructor(params: {
    kid: string;
    private_key: string;
    public_key: string;
    algorithm?: string;
    status?: JwtKeyStatus;
    expires_at?: Date;
  }) {
    super();
    this.kid = params.kid;
    this.private_key = params.private_key;
    this.public_key = params.public_key;
    if (params.algorithm) {
      this.algorithm = params.algorithm;
    }
    if (params.status) {
      this.status = params.status;
    }
    if (params.expires_at) {
      this.expires_at = params.expires_at;
    }
  }

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
