import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { SchedulerJobRepository } from '../repositories/scheduler-job.repository.ts';
import { BaseSchema } from './base.entity.ts';

export const SchedulerJobEntitySchema = defineEntity({
  name: 'SchedulerJobEntity',
  tableName: 'scheduled_jobs',
  comment: 'Persistent scheduler jobs and leases',
  extends: BaseSchema,
  repository: () => SchedulerJobRepository,
  properties: (p) => ({
    id: p.string().primary().comment('Stable scheduler job identifier'),
    name: p.string().comment('Human-readable scheduler job name'),
    enabled: p
      .boolean()
      .comment('Whether the scheduler job is enabled')
      .default(true),
    cron: p.string().comment('Cron expression for the job schedule'),
    nextRunAt: p.datetime().comment('Next scheduled run timestamp').nullable(),
    lastRunAt: p.datetime().comment('Last run start timestamp').nullable(),
    lastSuccessAt: p
      .datetime()
      .comment('Last successful completion timestamp')
      .nullable(),
    lastErrorAt: p
      .datetime()
      .comment('Last failed completion timestamp')
      .nullable(),
    lastError: p.text().comment('Last failure message').nullable(),
    lockedBy: p
      .string()
      .comment('Scheduler instance holding the lease')
      .nullable(),
    lockedUntil: p.datetime().comment('Lease expiration timestamp').nullable(),
    runCount: p.integer().comment('Total run attempts').default(0),
    failureCount: p.integer().comment('Total failed run attempts').default(0),
  }),
  indexes: [
    {
      name: 'scheduled_jobs_enabled_next_run_at_idx',
      properties: ['enabled', 'nextRunAt'],
    },
    {
      name: 'scheduled_jobs_locked_until_idx',
      properties: ['lockedUntil'],
    },
  ],
});

export type ISchedulerJobEntity = InferEntity<typeof SchedulerJobEntitySchema>;
