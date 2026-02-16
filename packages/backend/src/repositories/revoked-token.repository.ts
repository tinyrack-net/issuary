import type {
  IRevokedTokenEntity,
  TokenType,
} from '@backend/entities/revoked-token.entity.js';
import { EntityRepository } from '@mikro-orm/core';

/**
 * Repository for managing revoked tokens
 *
 * Implements OAuth 2.0 Token Revocation (RFC 7009) storage layer.
 * Supports both individual token revocation and bulk revocation
 * by user/client combination.
 */
export class RevokedTokenRepository extends EntityRepository<IRevokedTokenEntity> {
  /**
   * Revoke a single token by its JTI
   *
   * @param params - Token revocation parameters
   * @returns The created revoked token entity
   */
  async revokeToken(params: {
    jti: string;
    token_type: TokenType;
    clientId: string;
    userId: string;
    expires_at: Date;
  }): Promise<IRevokedTokenEntity> {
    // Check if already revoked
    const existing = await this.findOne({ jti: params.jti });
    if (existing) {
      return existing;
    }

    const entity = this.create({
      jti: params.jti,
      token_type: params.token_type,
      client: params.clientId,
      user: params.userId,
      expires_at: params.expires_at,
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
   * @param clientId - OAuth client ID
   * @param userId - User ID
   * @param tokens - Array of tokens to revoke with their metadata
   */
  async revokeAllForUserClient(
    clientId: string,
    userId: string,
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
          client: clientId,
          user: userId,
          expires_at: token.expires_at,
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

    const ids = expired.map((entity) => entity.id);
    await this.nativeDelete({ id: { $in: ids } });
    return expired.length;
  }
}
