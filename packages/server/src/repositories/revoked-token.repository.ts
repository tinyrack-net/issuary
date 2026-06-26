import {
  EntityRepository,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import type {
  IRevokedTokenEntity,
  TokenType,
} from '../entities/revoked-token.entity.ts';

/**
 * Repository for managing revoked tokens
 *
 * Implements OAuth 2.0 Token Revocation (RFC 7009) storage layer.
 * Supports both individual token revocation and bulk revocation
 * by user/client combination.
 */
export class RevokedTokenRepository extends EntityRepository<IRevokedTokenEntity> {
  private grantRevocationJti(grantId: string): string {
    return `grant:${grantId}`;
  }

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
    userSub?: string | undefined;
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
      expires_at: params.expires_at,
      ...(params.userSub !== undefined && { user: params.userSub }),
    });

    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  /**
   * Revoke a single token only if it has not already been revoked.
   *
   * @returns true when this call created the revocation entry.
   */
  async revokeTokenOnce(params: {
    jti: string;
    token_type: TokenType;
    clientId: string;
    userSub?: string | undefined;
    expires_at: Date;
  }): Promise<boolean> {
    const existing = await this.findOne({ jti: params.jti });
    if (existing) {
      return false;
    }

    const entity = this.create({
      jti: params.jti,
      token_type: params.token_type,
      client: params.clientId,
      expires_at: params.expires_at,
      ...(params.userSub !== undefined && { user: params.userSub }),
    });

    try {
      await this.getEntityManager().persist(entity).flush();
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        return false;
      }
      throw error;
    }
  }

  async revokeGrant(params: {
    grantId: string;
    clientId: string;
    userSub: string;
    expires_at: Date;
  }): Promise<IRevokedTokenEntity> {
    return this.revokeToken({
      jti: this.grantRevocationJti(params.grantId),
      token_type: 'refresh_token',
      clientId: params.clientId,
      userSub: params.userSub,
      expires_at: params.expires_at,
    });
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

  async isGrantRevoked(grantId: string): Promise<boolean> {
    return this.isRevoked(this.grantRevocationJti(grantId));
  }
}
