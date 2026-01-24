import { EntityRepository, ref } from '@mikro-orm/core';
import { TermsEntity } from '@/entities/terms.entity.js';
import type { TermsContentEntity } from '@/entities/terms-content.entity.js';

export class TermsContentRepository extends EntityRepository<TermsContentEntity> {
  /**
   * Find content for a specific term and language
   */
  async findByTermsAndLang(
    termsId: string,
    lang: string,
  ): Promise<TermsContentEntity | null> {
    return this.findOne({
      terms: ref(TermsEntity, termsId),
      lang,
    });
  }

  /**
   * Find all contents for a specific term
   */
  async findAllByTermsId(termsId: string): Promise<TermsContentEntity[]> {
    return this.find({
      terms: ref(TermsEntity, termsId),
    });
  }

  /**
   * Find content with fallback to English if the requested language is not available
   */
  async findByTermsAndLangWithFallback(
    termsId: string,
    lang: string,
  ): Promise<TermsContentEntity | null> {
    // Try requested language first
    const content = await this.findByTermsAndLang(termsId, lang);
    if (content) {
      return content;
    }

    // Fallback to English
    if (lang !== 'en') {
      return this.findByTermsAndLang(termsId, 'en');
    }

    return null;
  }
}
