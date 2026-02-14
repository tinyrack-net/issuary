import type { TermsEntity } from '@backend/entities/terms.entity.js';
import { EntityRepository, type Loaded } from '@mikro-orm/core';

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
