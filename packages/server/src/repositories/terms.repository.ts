import { EntityRepository, type Loaded } from '@mikro-orm/core';
import type { ITermsEntity } from '../entities/terms.entity.ts';

export class TermsRepository extends EntityRepository<ITermsEntity> {
  /**
   * Find all global terms with their localized contents
   */
  async findAllWithContents(): Promise<
    Loaded<ITermsEntity, 'contents', '*', never>[]
  > {
    return this.find(
      { archivedAt: null },
      {
        populate: ['contents'],
      },
    );
  }
}
