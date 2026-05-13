import { EntityRepository } from '@mikro-orm/core';
import type { ISchedulerJobEntity } from '../entities/scheduler-job.entity.ts';

export class SchedulerJobRepository extends EntityRepository<ISchedulerJobEntity> {}
