import type { ITermsEntity } from '@backend/entities/terms.entity.js';
import { EntityRepository, type Loaded } from '@mikro-orm/core';

export class TermsRepository extends EntityRepository<ITermsEntity> {
  /**
   * Find all global terms with their localized contents
   */
  async findAllWithContents(): Promise<
    Loaded<ITermsEntity, 'contents', '*', never>[]
  > {
    return this.findAll({
      populate: ['contents'],
    });
  }
}
