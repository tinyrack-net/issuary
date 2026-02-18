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
   * Check if a token is revoked by its JTI
   *
   * @param jti - JWT ID to check
   * @returns true if the token is revoked
   */
  async isRevoked(jti: string): Promise<boolean> {
    const count = await this.count({ jti });
    return count > 0;
  }
}
