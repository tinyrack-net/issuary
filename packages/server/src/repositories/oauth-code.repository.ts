import { EntityRepository } from '@mikro-orm/core';
import type {
  IOAuthCodeEntity,
  OAuthCodeChallengeMethods,
} from '../entities/oauth-code.entity.ts';

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
    codeHash: string | string[],
  ): Promise<IOAuthCodeEntity | null> {
    const codeHashes = Array.isArray(codeHash) ? codeHash : [codeHash];
    return this.findOne({
      client: clientId,
      codeHash: { $in: codeHashes },
      consumedAt: null,
    });
  }

  async consumeAuthorizationCode(params: {
    clientId: string;
    codeHash: string | string[];
    consumedAt: Date;
  }): Promise<IOAuthCodeEntity | null> {
    const codeHashes = Array.isArray(params.codeHash)
      ? params.codeHash
      : [params.codeHash];
    const updated = await this.nativeUpdate(
      {
        client: params.clientId,
        codeHash: { $in: codeHashes },
        consumedAt: null,
        expiredAt: { $gt: params.consumedAt },
      },
      { consumedAt: params.consumedAt },
    );

    if (updated !== 1) {
      return null;
    }

    return this.findOne({
      client: params.clientId,
      codeHash: { $in: codeHashes },
    });
  }
}
