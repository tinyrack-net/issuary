import { EntityRepository, rel } from '@mikro-orm/core';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import type { UserConsentEntity } from '@/entities/user-consent.entity.js';
import { UserEntity } from '@/entities/user.entity.js';

export class UserConsentRepository extends EntityRepository<UserConsentEntity> {
  /**
   * Find active consent for a user and client
   */
  async findConsent(
    userId: string,
    clientId: string,
  ): Promise<UserConsentEntity | null> {
    return this.findOne({
      user: rel(UserEntity, userId),
      client: rel(OAuthClientEntity, clientId),
      revoked_at: null,
    });
  }

  /**
   * Check if user has consented to all requested scopes for a client
   */
  async hasConsent(
    userId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<boolean> {
    const consent = await this.findConsent(userId, clientId);
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
    userId: string;
    clientId: string;
    scopes: string[];
  }): Promise<UserConsentEntity> {
    const existingConsent = await this.findConsent(
      params.userId,
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

    // Create new consent using rel() for FK references
    const consent = this.create({
      user: rel(UserEntity, params.userId),
      client: rel(OAuthClientEntity, params.clientId),
      scopes: params.scopes,
    });

    await this.getEntityManager().persist(consent).flush();
    return consent;
  }

  /**
   * Revoke consent for a user to a client
   */
  async revokeConsent(userId: string, clientId: string): Promise<boolean> {
    const consent = await this.findConsent(userId, clientId);
    if (!consent) {
      return false;
    }

    consent.revoked_at = new Date();
    await this.getEntityManager().flush();
    return true;
  }

  /**
   * Revoke all consents for a user
   */
  async revokeAllConsents(userId: string): Promise<number> {
    const consents = await this.find({
      user: rel(UserEntity, userId),
      revoked_at: null,
    });

    const now = new Date();
    for (const consent of consents) {
      consent.revoked_at = now;
    }

    await this.getEntityManager().flush();
    return consents.length;
  }

  /**
   * Get all active consents for a user
   */
  async findAllConsents(userId: string): Promise<UserConsentEntity[]> {
    return this.find({
      user: rel(UserEntity, userId),
      revoked_at: null,
    });
  }
}
