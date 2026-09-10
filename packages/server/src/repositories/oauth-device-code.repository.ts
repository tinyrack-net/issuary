import { EntityRepository } from '@mikro-orm/core';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.js';
import type { IOAuthDeviceCodeEntity } from '../entities/oauth-device-code.entity.ts';
import { UserEntity } from '../entities/user.entity.js';
import { lockOAuthClient } from '../services/client-security.js';

const DEVICE_CODE_POLL_INTERVAL_SECONDS = 5;

export type PendingDevicePollResult = 'authorization_pending' | 'slow_down';

export class OAuthDeviceCodeRepository extends EntityRepository<IOAuthDeviceCodeEntity> {
  private async withCurrentClient<T>(
    userCodeHash: string,
    operation: () => Promise<T>,
  ): Promise<T | null> {
    return this.getEntityManager().transactional(async (em) => {
      const code = await this.findOne({ userCodeHash }, { refresh: true });
      if (!code) return null;
      const client = await lockOAuthClient(em, code.client.id);
      if (
        !client ||
        client.deletedAt ||
        !client.enabled ||
        !client.tokenEpoch ||
        client.tokenEpoch !== code.client_epoch
      )
        return null;
      return operation();
    });
  }

  async createDeviceAuthorization(params: {
    clientId: string;
    clientEpoch?: string;
    deviceCodeHash: string;
    userCodeHash: string;
    scope: string[];
    expiresInSeconds?: number;
  }): Promise<IOAuthDeviceCodeEntity> {
    const expiresInSeconds = params.expiresInSeconds ?? 600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const client = await this.getEntityManager().findOneOrFail(
      OAuthClientEntitySchema,
      { id: params.clientId },
    );
    const entity = this.create({
      client: params.clientId,
      client_epoch: params.clientEpoch ?? client.tokenEpoch ?? '',
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
    const code = await this.findOne(
      {
        userCodeHash,
        consumedAt: null,
        authorizedAt: null,
        deniedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { populate: ['client'], refresh: true },
    );
    if (
      !code ||
      code.client.deletedAt ||
      !code.client.enabled ||
      !code.client.tokenEpoch ||
      code.client_epoch !== code.client.tokenEpoch
    )
      return null;
    return code;
  }

  async approvePendingByUserCodeHash(params: {
    userCodeHash: string;
    userSub: string;
    userEpoch?: string;
    approvedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    return this.withCurrentClient(params.userCodeHash, async () => {
      const user = await this.getEntityManager().findOneOrFail(UserEntity, {
        sub: params.userSub,
      });
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
          user_epoch: params.userEpoch ?? user.token_epoch,
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
    });
  }

  async denyPendingByUserCodeHash(params: {
    userCodeHash: string;
    deniedAt: Date;
  }): Promise<IOAuthDeviceCodeEntity | null> {
    return this.withCurrentClient(params.userCodeHash, async () => {
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
    });
  }

  async findByClientAndDeviceCodeHash(
    clientId: string,
    deviceCodeHash: string,
  ): Promise<IOAuthDeviceCodeEntity | null> {
    return this.findOne(
      {
        client: clientId,
        deviceCodeHash,
        consumedAt: null,
      },
      { refresh: true },
    );
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
      return 'slow_down';
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
