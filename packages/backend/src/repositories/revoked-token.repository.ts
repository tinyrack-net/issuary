import { EntityRepository } from '@mikro-orm/core';
import type {
  RevokedTokenEntity,
  TokenType,
} from '@/entities/revoked-token.entity.js';

/**
 * Repository for managing revoked tokens
 *
 * Implements OAuth 2.0 Token Revocation (RFC 7009) storage layer.
 * Supports both individual token revocation and bulk revocation
 * by user/client combination.
 */
export class RevokedTokenRepository extends EntityRepository<RevokedTokenEntity> {
  /**
   * Revoke a single token by its JTI
   *
   * @param params - Token revocation parameters
   * @returns The created revoked token entity
   */
  async revokeToken(params: {
    jti: string;
    token_type: TokenType;
    client_id: string;
    user_id: string;
    expires_at: Date;
  }): Promise<RevokedTokenEntity> {
    // Check if already revoked
    const existing = await this.findOne({ jti: params.jti });
    if (existing) {
      return existing;
    }

    const entity = this.create({
      jti: params.jti,
      token_type: params.token_type,
      client_id: params.client_id,
      user_id: params.user_id,
      expires_at: params.expires_at,
      revoked_at: new Date(),
    });

    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  /**
   * Revoke all tokens for a user/client combination
   *
   * Used when revoking a refresh token to also invalidate
   * all associated access tokens (RFC 7009 recommendation).
   *
   * @param client_id - OAuth client ID
   * @param user_id - User ID
   * @param tokens - Array of tokens to revoke with their metadata
   */
  async revokeAllForUserClient(
    client_id: string,
    user_id: string,
    tokens: Array<{
      jti: string;
      token_type: TokenType;
      expires_at: Date;
    }>,
  ): Promise<void> {
    for (const token of tokens) {
      const existing = await this.findOne({ jti: token.jti });
      if (!existing) {
        const entity = this.create({
          jti: token.jti,
          token_type: token.token_type,
          client_id,
          user_id,
          expires_at: token.expires_at,
          revoked_at: new Date(),
        });
        this.getEntityManager().persist(entity);
      }
    }

    await this.getEntityManager().flush();
  }

  /**
   * Check if a token is revoked by its JTI
   *
   * @param jti - JWT ID to check
   * @returns true if the token is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    const count = await this.count({ jti });
    return count > 0;
  }

  /**
   * Clean up expired revoked tokens
   *
   * Revoked tokens can be deleted after their original expiration time
   * since they would be invalid anyway.
   *
   * @returns Number of deleted records
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.find({
      expires_at: { $lt: now },
    });

    if (expired.length === 0) {
      return 0;
    }

    for (const entity of expired) {
      this.getEntityManager().remove(entity);
    }

    await this.getEntityManager().flush();
    return expired.length;
  }
}
