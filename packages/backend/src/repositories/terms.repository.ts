import { EntityRepository, type Loaded } from '@mikro-orm/core';
import type { TermsEntity } from '@/entities/terms.entity.js';

export class TermsRepository extends EntityRepository<TermsEntity> {
  /**
   * Find all global terms with their localized contents
   */
  async findAllWithContents(): Promise<
    Loaded<TermsEntity, 'contents', '*', never>[]
  > {
    return this.findAll({
      populate: ['contents'],
    });
  }
}
