import { EntityRepository } from '@mikro-orm/core';
import type { IOAuthDeviceCodeEntity } from '../entities/oauth-device-code.entity.ts';

const DEVICE_CODE_POLL_INTERVAL_SECONDS = 5;

export type PendingDevicePollResult = 'authorization_pending' | 'slow_down';

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
    userCodeHash: string | string[],
  ): Promise<IOAuthDeviceCodeEntity | null> {
    const userCodeHashes = Array.isArray(userCodeHash)
      ? userCodeHash
      : [userCodeHash];
    return this.findOne({
      userCodeHash: { $in: userCodeHashes },
      consumedAt: null,
      authorizedAt: null,
      deniedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  async approvePendingByUserCodeHash(params: {
    userCodeHash: string | string[];
    userSub: string;
    approvedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    const userCodeHashes = Array.isArray(params.userCodeHash)
      ? params.userCodeHash
      : [params.userCodeHash];
    const updated = await this.nativeUpdate(
      {
        userCodeHash: { $in: userCodeHashes },
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
      { userCodeHash: { $in: userCodeHashes } },
      { populate: ['client'] },
    );
  }

  async denyPendingByUserCodeHash(params: {
    userCodeHash: string | string[];
    deniedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    const userCodeHashes = Array.isArray(params.userCodeHash)
      ? params.userCodeHash
      : [params.userCodeHash];
    const updated = await this.nativeUpdate(
      {
        userCodeHash: { $in: userCodeHashes },
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
      { userCodeHash: { $in: userCodeHashes } },
      { populate: ['client'] },
    );
  }

  async findByClientAndDeviceCodeHash(
    clientId: string,
    deviceCodeHash: string | string[],
  ): Promise<IOAuthDeviceCodeEntity | null> {
    const deviceCodeHashes = Array.isArray(deviceCodeHash)
      ? deviceCodeHash
      : [deviceCodeHash];
    return this.findOne({
      client: clientId,
      deviceCodeHash: { $in: deviceCodeHashes },
      consumedAt: null,
    });
  }

  async recordPendingPoll(params: {
    id: string;
    polledAt: Date;
  }): Promise<PendingDevicePollResult | null> {
    const deviceCode = await this.findOne(
      {
        id: params.id,
        consumedAt: null,
        authorizedAt: null,
        deniedAt: null,
        expiresAt: { $gt: params.polledAt },
      },
      { refresh: true },
    );

    if (!deviceCode) {
      return null;
    }

    const intervalSeconds =
      deviceCode.pollIntervalSeconds ?? DEVICE_CODE_POLL_INTERVAL_SECONDS;
    const lastPolledAtMs = deviceCode.lastPolledAt?.getTime();
    const isSlowDown =
      lastPolledAtMs !== undefined &&
      params.polledAt.getTime() - lastPolledAtMs < intervalSeconds * 1000;
    const nextIntervalSeconds = isSlowDown
      ? intervalSeconds + 5
      : intervalSeconds;

    const updated = await this.nativeUpdate(
      {
        id: params.id,
        consumedAt: null,
        authorizedAt: null,
        deniedAt: null,
        expiresAt: { $gt: params.polledAt },
        pollIntervalSeconds: intervalSeconds,
        lastPolledAt: deviceCode.lastPolledAt ?? null,
      },
      {
        lastPolledAt: params.polledAt,
        pollIntervalSeconds: nextIntervalSeconds,
      },
    );

    if (updated !== 1) {
      return this.recordPendingPoll(params);
    }

    return isSlowDown ? 'slow_down' : 'authorization_pending';
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
