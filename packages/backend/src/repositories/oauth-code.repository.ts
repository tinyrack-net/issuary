import { EntityRepository } from '@mikro-orm/core';
import type {
  IOAuthCodeEntity,
  OAuthCodeChallengeMethods,
} from '#backend/entities/oauth-code.entity.js';

export class OAuthCodeRepository extends EntityRepository<IOAuthCodeEntity> {
  async createAuthorizationCode(params: {
    clientId: string;
    userSub: string;
    codeHash: string;
    redirectUri: string;
    scope: string[];
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: OAuthCodeChallengeMethods;
    expiresInSeconds?: number;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
  }): Promise<IOAuthCodeEntity> {
    const expiresInSeconds = params.expiresInSeconds || 600;
    const expiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    const entity = this.create({
      client: params.clientId,
      user: params.userSub,
      codeHash: params.codeHash,
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

    await this.getEntityManager().persist(entity).flush();

    return entity;
  }

  async findUnconsumedByClientAndCodeHash(
    clientId: string,
    codeHash: string,
  ): Promise<IOAuthCodeEntity | null> {
    return this.findOne({
      client: clientId,
      codeHash,
      consumedAt: null,
    });
  }
}
