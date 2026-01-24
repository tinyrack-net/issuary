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

  /**
   * Find a term by ID with its localized contents
   */
  async findByIdWithContents(
    id: string,
  ): Promise<Loaded<TermsEntity, 'contents', '*', never> | null> {
    return this.findOne(
      { id },
      {
        populate: ['contents'],
      },
    );
  }

  /**
   * Find all required terms
   */
  async findRequiredTerms(): Promise<TermsEntity[]> {
    return this.find({ required: true });
  }

  /**
   * Check if any required terms exist
   */
  async hasRequiredTerms(): Promise<boolean> {
    const count = await this.count({ required: true });
    return count > 0;
  }
}
