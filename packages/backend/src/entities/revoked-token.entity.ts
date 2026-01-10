import {
  Entity,
  EntityRepositoryType,
  Enum,
  Index,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { RevokedTokenRepository } from '@/repositories/revoked-token.repository.js';
import { BaseEntity } from './base.entity.js';

/**
 * Token types that can be revoked
 */
export const TOKEN_TYPE = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

/**
 * Revoked Token Entity
 *
 * Stores revoked tokens to implement OAuth 2.0 Token Revocation (RFC 7009).
 * Since tokens are JWTs (stateless), we need to track revoked tokens
 * to invalidate them before their natural expiration.
 *
 * Supports both individual token revocation (by jti) and
 * bulk revocation (by user_id + client_id combination).
 */
@Entity({
  tableName: 'revoked_tokens',
  comment: 'Revoked OAuth tokens for invalidation before expiry',
  repository: () => RevokedTokenRepository,
})
export class RevokedTokenEntity extends BaseEntity {
  [EntityRepositoryType]?: RevokedTokenRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @Index({
    name: 'revoked_token_jti_idx',
    properties: ['jti'],
  })
  @Property({
    type: t.string,
    name: 'jti',
    comment: 'JWT ID (jti claim) of the revoked token',
    nullable: false,
    unique: true,
  })
  public jti!: string;

  @Enum({
    type: t.enum,
    items: () => TOKEN_TYPE,
    name: 'token_type',
    comment: 'Type of the revoked token (access_token or refresh_token)',
    nullable: false,
  })
  public token_type!: TokenType;

  @Index({
    name: 'revoked_token_client_user_idx',
    properties: ['client_id', 'user_id'],
  })
  @Property({
    type: t.string,
    name: 'client_id',
    comment: 'OAuth client ID that the token was issued to',
    nullable: false,
  })
  public client_id!: string;

  @Property({
    type: t.string,
    name: 'user_id',
    comment: 'User ID (subject) that the token was issued for',
    nullable: false,
  })
  public user_id!: string;

  @Index({
    name: 'revoked_token_expires_at_idx',
    properties: ['expires_at'],
  })
  @Property({
    type: t.datetime,
    name: 'expires_at',
    comment:
      'Original expiration time of the token. Used for cleanup of expired entries.',
    nullable: false,
  })
  public expires_at!: Date;

  @Property({
    type: t.datetime,
    name: 'revoked_at',
    comment: 'Timestamp when the token was revoked',
    nullable: false,
  })
  public revoked_at: Date = new Date();
}
