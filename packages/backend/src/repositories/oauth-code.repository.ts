import { randomBytes } from 'node:crypto';
import { EntityRepository } from '@mikro-orm/core';
import { hash, verify } from 'argon2';
import type { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { e } from '@/schemas/error.js';

export class OAuthCodeRepository extends EntityRepository<OAuthCodeEntity> {
  /**
   * Generate and store a new authorization code
   * @returns Object containing the plain code and the created entity
   */
  async generateAuthorizationCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string[];
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
    expiresInSeconds?: number;
  }): Promise<{ code: string; entity: OAuthCodeEntity }> {
    // Generate a cryptographically secure random code
    const code = randomBytes(32).toString('base64url');

    // Hash the code before storing
    const codeHash = await hash(code);

    // Calculate expiration time (default: 10 minutes)
    const expiresInSeconds = params.expiresInSeconds || 600;
    const expiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Create the entity
    const entity = this.create({
      codeHash,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      nonce: params.nonce || '',
      codeChallenge: params.codeChallenge || '',
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      expiredAt,
    });

    // Persist to database
    await this.getEntityManager().persist(entity).flush();

    return { code, entity };
  }

  /**
   * Verify and consume an authorization code
   * @returns The OAuthCodeEntity if valid, null otherwise
   */
  async verifyAndConsumeCode(
    code: string,
    clientId: string,
  ): Promise<OAuthCodeEntity | null> {
    // Find all unconsumed codes for this client
    const codes = await this.find({
      clientId,
      consumedAt: null,
    });

    // Check each code's hash
    for (const codeEntity of codes) {
      const isValid = await verify(codeEntity.codeHash, code);

      if (isValid) {
        // Check if expired
        if (codeEntity.expiredAt < new Date()) {
          throw new e.InvalidAuthorizationCode.Error();
        }

        // Mark as consumed
        codeEntity.consumedAt = new Date();
        await this.getEntityManager().flush();

        return codeEntity;
      }
    }

    return null;
  }
}
