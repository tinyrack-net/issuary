import { UserEntity } from '@backend/entities/user.entity.js';
import type { UserConsentEntity } from '@backend/entities/user-consent.entity.js';
import { EntityRepository, ref } from '@mikro-orm/core';

export class UserConsentRepository extends EntityRepository<UserConsentEntity> {
  /**
   * Find active consent for a user and client
   */
  async findConsent(
    userSub: string,
    clientId: string,
  ): Promise<UserConsentEntity | null> {
    return this.findOne({
      user: ref(UserEntity, userSub),
      client: clientId,
      revoked_at: null,
    });
  }

  /**
   * Check if user has consented to all requested scopes for a client
   */
  async hasConsent(
    userSub: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    const consent = await this.findConsent(userSub, clientId);
    if (!consent) {
      return false;
    }
    return consent.hasScopes(requestedScopes);
  }

  /**
   * Grant consent for a user to a client with specific scopes.
   * If consent already exists, update the scopes (merge with existing).
   */
  async grantConsent(params: {
    userSub: string;
    clientId: string;
    scopes: string[];
  }): Promise<UserConsentEntity> {
    const existingConsent = await this.findConsent(
      params.userSub,
      params.clientId,
    );

    if (existingConsent) {
      // Merge scopes (add new scopes to existing ones)
      const mergedScopes = [
        ...new Set([...existingConsent.scopes, ...params.scopes]),
      ];
      existingConsent.scopes = mergedScopes;
      existingConsent.granted_at = new Date();
      existingConsent.revoked_at = null;
      await this.getEntityManager().flush();
      return existingConsent;
    }

    // Create new consent
    const consent = this.create({
      user: params.userSub,
      client: params.clientId,
      scopes: params.scopes,
    });

    await this.getEntityManager().persist(consent).flush();
    return consent;
  }
}
