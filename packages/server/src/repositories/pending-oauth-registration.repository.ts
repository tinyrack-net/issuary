import { EntityRepository } from '@mikro-orm/core';
import type { IPendingOAuthRegistrationEntity } from '../entities/pending-oauth-registration.entity.ts';

export interface CreatePendingRegistrationParams {
  providerId: string;
  accessToken: string;
  refreshToken?: string | undefined;
  expiresIn?: number | undefined;
  tokenType: string;
  userInfo: {
    id: string;
    email: string;
    email_verified: boolean;
    name?: string | undefined;
    picture?: string | undefined;
  };
  returnUrl?: string | undefined;
  expiresAt: Date;
}

export class PendingOAuthRegistrationRepository extends EntityRepository<IPendingOAuthRegistrationEntity> {
  /**
   * Create a pending registration record and return its lookup token.
   */
  async createPendingRegistration(
    params: CreatePendingRegistrationParams,
  ): Promise<string> {
    const token = crypto.randomUUID();

    const entity = this.create({
      token,
      providerId: params.providerId,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiresIn: params.expiresIn ?? null,
      tokenType: params.tokenType,
      userInfo: params.userInfo,
      returnUrl: params.returnUrl ?? null,
      expiresAt: params.expiresAt,
    });

    this.getEntityManager().persist(entity);
    await this.getEntityManager().flush();

    return token;
  }

  /**
   * Find a valid (non-expired) pending registration by its token.
   * Eagerly loads lazy fields (accessToken, refreshToken).
   */
  async claim(token: string): Promise<IPendingOAuthRegistrationEntity | null> {
    const changed = await this.nativeUpdate(
      { token, consumed_at: null, expiresAt: { $gt: new Date() } },
      { consumed_at: new Date() },
    );
    if (changed !== 1) return null;
    return this.findOne(
      { token },
      { populate: ['accessToken', 'refreshToken'], refresh: true },
    );
  }

  async findValidByToken(
    token: string,
  ): Promise<IPendingOAuthRegistrationEntity | null> {
    const entity = await this.findOne(
      { token, consumed_at: null },
      { populate: ['accessToken', 'refreshToken'] },
    );
    if (!entity) return null;
    if (entity.expiresAt <= new Date()) return null;
    return entity;
  }

  /**
   * Delete a pending registration record after it has been consumed.
   */
  async consumeByToken(token: string): Promise<void> {
    await this.nativeDelete({ token });
  }

  /**
   * Delete all expired pending registrations.
   */
  async invalidateIdentity(
    providerId: string,
    providerUserId: string,
    email: string,
  ): Promise<void> {
    await this.nativeDelete({
      $or: [
        { providerId, userInfo: { id: providerUserId } },
        { userInfo: { email } },
      ],
    });
  }

  async cleanExpired(cutoffDate: Date): Promise<number> {
    return await this.nativeDelete({
      expiresAt: { $lt: cutoffDate },
    });
  }
}
