import { randomBytes } from 'node:crypto';
import { EntityRepository, ref } from '@mikro-orm/core';
import { hash, verify } from 'argon2';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import {
  type OAuthCodeChallengeMethods,
  OAuthCodeEntity,
} from '@/entities/oauth-code.entity.js';
import type {
  AuthenticationContextClass,
  AuthenticationMethod,
} from '@/plugins/secure-session.js';
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
    codeChallengeMethod?: OAuthCodeChallengeMethods;
    expiresInSeconds?: number;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
    /** OIDC: Authentication Methods References (RFC 8176) */
    amr?: AuthenticationMethod[];
    /** OIDC: Authentication Context Class Reference */
    acr?: AuthenticationContextClass;
  }): Promise<{ code: string; entity: OAuthCodeEntity }> {
    // Generate a cryptographically secure random code
    const code = randomBytes(32).toString('base64url');

    // Hash the code before storing
    const codeHash = await hash(code);

    // Calculate expiration time (default: 10 minutes)
    const expiresInSeconds = params.expiresInSeconds || 600;
    const expiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Create the entity using constructor
    const entity = new OAuthCodeEntity({
      clientId: params.clientId,
      userId: params.userId,
      codeHash,
      redirectUri: params.redirectUri,
      scope: params.scope,
      nonce: params.nonce || '',
      codeChallenge: params.codeChallenge || '',
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      expiredAt,
      // Only include OIDC auth metadata when defined (exactOptionalPropertyTypes)
      ...(params.authTime !== undefined && { authTime: params.authTime }),
      ...(params.amr !== undefined && { amr: params.amr }),
      ...(params.acr !== undefined && { acr: params.acr }),
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
      client: ref(OAuthClientEntity, clientId),
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
