import { EntityRepository } from '@mikro-orm/core';
import type { TermsContentEntity } from '@/entities/terms-content.entity.js';

export class TermsContentRepository extends EntityRepository<TermsContentEntity> {}
