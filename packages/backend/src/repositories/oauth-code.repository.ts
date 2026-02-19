import type {
  IOAuthCodeEntity,
  OAuthCodeChallengeMethods,
} from '@backend/entities/oauth-code.entity.js';
import { getRandomBytes, toBase64Url } from '@backend/lib/base64url.js';
import { e } from '@backend/schemas/error.js';
import { EntityRepository } from '@mikro-orm/core';
import { hash, verify } from '@node-rs/argon2';

export class OAuthCodeRepository extends EntityRepository<IOAuthCodeEntity> {
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
    codeChallengeMethod?: OAuthCodeChallengeMethods;
    expiresInSeconds?: number;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
  }): Promise<{ code: string; entity: IOAuthCodeEntity }> {
    // Generate a cryptographically secure random code
    const code = toBase64Url(getRandomBytes(32));

    // Hash the code before storing
    const codeHash = await hash(code);

    // Calculate expiration time (default: 10 minutes)
    const expiresInSeconds = params.expiresInSeconds || 600;
    const expiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Create the entity
    const entity = this.create({
      client: params.clientId,
      user: params.userId,
      codeHash,
      redirectUri: params.redirectUri,
      scope: params.scope,
      nonce: params.nonce || '',
      codeChallenge: params.codeChallenge || '',
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      expiredAt,
      // Only include OIDC auth metadata when defined (exactOptionalPropertyTypes)
      ...(params.authTime !== undefined && {
        authTime: params.authTime,
      }),
    });

    // Persist to database
    await this.getEntityManager().persist(entity).flush();

    return { code, entity };
  }

  /**
   * Verify and consume an authorization code
   * @returns The IOAuthCodeEntity if valid, null otherwise
   */
  async verifyAndConsumeCode(
    code: string,
    clientId: string,
  ): Promise<IOAuthCodeEntity | null> {
    // Find all unconsumed codes for this client
    const codes = await this.find({
      client: clientId,
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
