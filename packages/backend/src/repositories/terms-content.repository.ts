import { EntityRepository } from '@mikro-orm/core';
import type { ITermsContentEntity } from '../entities/terms-content.entity.ts';

export class TermsContentRepository extends EntityRepository<ITermsContentEntity> {}
