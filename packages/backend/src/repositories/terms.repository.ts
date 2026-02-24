import { EntityRepository, type Loaded } from '@mikro-orm/core';
import type { ITermsEntity } from '#backend/entities/terms.entity.js';

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
