import { EntityRepository, ref } from '@mikro-orm/core';
import { UserEntity } from '#backend/entities/user.entity.js';
import type { UserTermsConsentEntity } from '#backend/entities/user-terms-consent.entity.js';

export class UserTermsConsentRepository extends EntityRepository<UserTermsConsentEntity> {
  /**
   * Find the latest consent record for a user and specific term
   */
  async findLatestConsent(
    userSub: string,
    termsId: string,
  ): Promise<UserTermsConsentEntity | null> {
    return this.findOne(
      {
        user: ref(UserEntity, userSub),
        terms: termsId,
      },
      {
        orderBy: { agreedAt: 'DESC' },
      },
    );
  }

  /**
   * Find all consent records for a user
   */
  async findAllConsents(userSub: string): Promise<UserTermsConsentEntity[]> {
    return this.find(
      {
        user: ref(UserEntity, userSub),
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
    userSub: string,
  ): Promise<Map<string, UserTermsConsentEntity>> {
    const consents = await this.findAllConsents(userSub);
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
    userSub: string;
    termsId: string;
    termsVersion: string;
    agreed: boolean;
    consentType: 'explicit' | 'implicit';
  }): Promise<UserTermsConsentEntity> {
    const consent = this.create({
      user: params.userSub,
      terms: params.termsId,
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
      userSub: string;
      termsId: string;
      termsVersion: string;
      agreed: boolean;
      consentType: 'explicit' | 'implicit';
    }>,
  ): Promise<UserTermsConsentEntity[]> {
    const consents = params.map((p) =>
      this.create({
        user: p.userSub,
        terms: p.termsId,
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
