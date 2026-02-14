import { TermsEntity } from '@backend/entities/terms.entity.js';
import { UserEntity } from '@backend/entities/user.entity.js';
import { UserTermsConsentEntity } from '@backend/entities/user-terms-consent.entity.js';
import { EntityRepository, ref } from '@mikro-orm/core';

export class UserTermsConsentRepository extends EntityRepository<UserTermsConsentEntity> {
  /**
   * Find the latest consent record for a user and specific term
   */
  async findLatestConsent(
    userId: string,
    termsId: string,
  ): Promise<UserTermsConsentEntity | null> {
    return this.findOne(
      {
        user: ref(UserEntity, userId),
        terms: ref(TermsEntity, termsId),
      },
      {
        orderBy: { agreedAt: 'DESC' },
      },
    );
  }

  /**
   * Find all consent records for a user
   */
  async findAllConsents(userId: string): Promise<UserTermsConsentEntity[]> {
    return this.find(
      {
        user: ref(UserEntity, userId),
      },
      {
        orderBy: { agreedAt: 'DESC' },
      },
    );
  }

  /**
   * Find the latest consents for each term for a user
   * Returns a map of termsId -> consent
   */
  async findLatestConsentsMap(
    userId: string,
  ): Promise<Map<string, UserTermsConsentEntity>> {
    const consents = await this.findAllConsents(userId);
    const map = new Map<string, UserTermsConsentEntity>();

    // Since results are ordered by agreedAt DESC, first occurrence is the latest
    for (const consent of consents) {
      if (!map.has(consent.termsId)) {
        map.set(consent.termsId, consent);
      }
    }

    return map;
  }

  /**
   * Record a new consent
   */
  async recordConsent(params: {
    userId: string;
    termsId: string;
    termsVersion: string;
    agreed: boolean;
    consentType: 'explicit' | 'implicit';
  }): Promise<UserTermsConsentEntity> {
    const consent = new UserTermsConsentEntity({
      userId: params.userId,
      termsId: params.termsId,
      termsVersion: params.termsVersion,
      agreed: params.agreed,
      consentType: params.consentType,
    });

    await this.getEntityManager().persist(consent).flush();
    return consent;
  }

  /**
   * Record multiple consents at once
   */
  async recordConsents(
    params: Array<{
      userId: string;
      termsId: string;
      termsVersion: string;
      agreed: boolean;
      consentType: 'explicit' | 'implicit';
    }>,
  ): Promise<UserTermsConsentEntity[]> {
    const consents = params.map(
      (p) =>
        new UserTermsConsentEntity({
          userId: p.userId,
          termsId: p.termsId,
          termsVersion: p.termsVersion,
          agreed: p.agreed,
          consentType: p.consentType,
        }),
    );

    await this.getEntityManager().persist(consents).flush();
    return consents;
  }
}
