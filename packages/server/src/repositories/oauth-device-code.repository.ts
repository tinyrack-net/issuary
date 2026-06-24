import { EntityRepository } from '@mikro-orm/core';
import type { IOAuthDeviceCodeEntity } from '../entities/oauth-device-code.entity.ts';

export class OAuthDeviceCodeRepository extends EntityRepository<IOAuthDeviceCodeEntity> {
  async createDeviceAuthorization(params: {
    clientId: string;
    deviceCodeHash: string;
    userCodeHash: string;
    scope: string[];
    expiresInSeconds?: number;
  }): Promise<IOAuthDeviceCodeEntity> {
    const expiresInSeconds = params.expiresInSeconds ?? 600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const entity = this.create({
      client: params.clientId,
      deviceCodeHash: params.deviceCodeHash,
      userCodeHash: params.userCodeHash,
      scope: params.scope,
      expiresAt,
    });

    await this.getEntityManager().persist(entity).flush();
    return entity;
  }

  async findPendingByUserCodeHash(
    userCodeHash: string,
  ): Promise<IOAuthDeviceCodeEntity | null> {
    return this.findOne({
      userCodeHash,
      consumedAt: null,
      authorizedAt: null,
      deniedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  async approvePendingByUserCodeHash(params: {
    userCodeHash: string;
    userSub: string;
    approvedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    const updated = await this.nativeUpdate(
      {
        userCodeHash: params.userCodeHash,
        consumedAt: null,
        authorizedAt: null,
        deniedAt: null,
        expiresAt: { $gt: params.approvedAt },
      },
      {
        authorizedUser: params.userSub,
        authorizedAt: params.approvedAt,
      },
    );

    if (updated !== 1) {
      return null;
    }

    return this.findOne(
      { userCodeHash: params.userCodeHash },
      { populate: ['client'] },
    );
  }

  async denyPendingByUserCodeHash(params: {
    userCodeHash: string;
    deniedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    const updated = await this.nativeUpdate(
      {
        userCodeHash: params.userCodeHash,
        consumedAt: null,
        authorizedAt: null,
        deniedAt: null,
        expiresAt: { $gt: params.deniedAt },
      },
      {
        deniedAt: params.deniedAt,
      },
    );

    if (updated !== 1) {
      return null;
    }

    return this.findOne(
      { userCodeHash: params.userCodeHash },
      { populate: ['client'] },
    );
  }

  async findByClientAndDeviceCodeHash(
    clientId: string,
    deviceCodeHash: string,
  ): Promise<IOAuthDeviceCodeEntity | null> {
    return this.findOne({
      client: clientId,
      deviceCodeHash,
      consumedAt: null,
    });
  }

  async consumeAuthorizedDeviceCode(
    id: string,
    consumedAt: Date,
  ): Promise<boolean> {
    const updated = await this.nativeUpdate(
      {
        id,
        consumedAt: null,
        authorizedAt: { $ne: null },
        deniedAt: null,
        expiresAt: { $gt: consumedAt },
      },
      { consumedAt },
    );

    return updated === 1;
  }
}
