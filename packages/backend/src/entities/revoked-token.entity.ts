import { RevokedTokenRepository } from '@backend/repositories/revoked-token.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { OAuthClientEntitySchema } from './oauth-client.entity.js';
import { UserEntitySchema } from './user.entity.js';

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
 * bulk revocation (by user_sub + client_id combination).
 */
export const RevokedTokenEntitySchema = defineEntity({
  name: 'RevokedTokenEntity',
  tableName: 'revoked_tokens',
  comment: 'Revoked OAuth tokens for invalidation before expiry',
  extends: BaseSchema,
  repository: () => RevokedTokenRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    jti: p.string().comment('JWT ID (jti claim) of the revoked token').unique(),
    token_type: p
      .enum(() => TOKEN_TYPE)
      .comment('Type of the revoked token (access_token or refresh_token)'),
    client: () =>
      p
        .manyToOne(OAuthClientEntitySchema)
        .comment('Reference to the OAuth client that the token was issued to'),
    user: () =>
      p
        .manyToOne(UserEntitySchema)
        .comment(
          'Reference to the user (subject) that the token was issued for',
        ),
    expires_at: p
      .datetime()
      .comment(
        'Original expiration time of the token. Used for cleanup of expired entries.',
      ),
    revoked_at: p
      .datetime()
      .comment('Timestamp when the token was revoked')
      .onCreate(() => new Date()),
  }),
  indexes: [
    {
      name: 'revoked_token_jti_idx',
      properties: ['jti'],
    },
    {
      name: 'revoked_token_client_user_idx',
      properties: ['client', 'user'],
    },
    {
      name: 'revoked_token_expires_at_idx',
      properties: ['expires_at'],
    },
  ],
});

export type IRevokedTokenEntity = InferEntity<typeof RevokedTokenEntitySchema>;
