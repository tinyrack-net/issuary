import { EntityRepository } from '@mikro-orm/core';
import type { ITermsContentEntity } from '#backend/entities/terms-content.entity.js';

export class TermsContentRepository extends EntityRepository<ITermsContentEntity> {}
