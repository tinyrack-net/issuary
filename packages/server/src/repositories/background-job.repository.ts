import { EntityRepository } from '@mikro-orm/core';
import type { IBackgroundJobEntity } from '../entities/background-job.entity.ts';

export class BackgroundJobRepository extends EntityRepository<IBackgroundJobEntity> {}
