import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BackgroundJobRepository } from '../repositories/background-job.repository.ts';
import { BaseSchema } from './base.entity.ts';

export const BackgroundJobEntitySchema = defineEntity({
  name: 'BackgroundJobEntity',
  tableName: 'background_jobs',
  comment: 'Durable background job queue',
  extends: BaseSchema,
  repository: () => BackgroundJobRepository,
  properties: (p) => ({
    id: p.string().primary().comment('Stable background job execution id'),
    jobId: p.string().comment('Registered background job identifier'),
    payload: p.text().comment('Serialized JSON job payload'),
    status: p.string().comment('Background job status').default('pending'),
    availableAt: p.datetime().comment('Earliest time this job can run'),
    lockedBy: p
      .string()
      .comment('Scheduler instance holding the lease')
      .nullable(),
    lockedUntil: p.datetime().comment('Lease expiration timestamp').nullable(),
    attemptCount: p.integer().comment('Total run attempts').default(0),
    maxAttempts: p.integer().comment('Maximum run attempts').default(3),
    lastError: p.text().comment('Last failure message').nullable(),
    completedAt: p.datetime().comment('Completion timestamp').nullable(),
  }),
  indexes: [
    {
      name: 'background_jobs_status_available_at_idx',
      properties: ['status', 'availableAt'],
    },
    {
      name: 'background_jobs_locked_until_idx',
      properties: ['lockedUntil'],
    },
    {
      name: 'background_jobs_job_id_idx',
      properties: ['jobId'],
    },
  ],
});

export type IBackgroundJobEntity = InferEntity<
  typeof BackgroundJobEntitySchema
>;
