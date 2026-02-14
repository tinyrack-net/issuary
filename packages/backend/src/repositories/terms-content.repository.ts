import type { TermsContentEntity } from '@backend/entities/terms-content.entity.js';
import { EntityRepository } from '@mikro-orm/core';

export class TermsContentRepository extends EntityRepository<TermsContentEntity> {}
