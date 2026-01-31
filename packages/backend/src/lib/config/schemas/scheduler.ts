import z from 'zod/v4';

/**
 * Configuration for a single scheduled job
 */
export const SchedulerJobConfig = z.object({
  enabled: z.boolean().default(true).describe('Whether this job is enabled'),
  cron: z.string().describe('Cron expression for job schedule'),
});

export type SchedulerJobConfig = z.infer<typeof SchedulerJobConfig>;

/**
 * Default scheduler jobs configuration
 */
export const DEFAULT_SCHEDULER_JOBS = {
  rotate_jwt_keys: {
    enabled: true,
    cron: '0 0 * * *', // Daily at midnight
  },
  cleanup_expired_tokens: {
    enabled: true,
    cron: '0 */6 * * *', // Every 6 hours
  },
  cleanup_sessions: {
    enabled: true,
    cron: '0 1 * * *', // Daily at 1 AM
  },
  cleanup_deleted_users: {
    enabled: true,
    cron: '0 2 * * 0', // Weekly on Sunday at 2 AM
  },
} as const;

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG = {
  enabled: true,
  jobs: DEFAULT_SCHEDULER_JOBS,
} as const;

/**
 * Jobs object schema
 */
export const SchedulerJobsConfig = z.object({
  rotate_jwt_keys: SchedulerJobConfig.default(
    DEFAULT_SCHEDULER_JOBS.rotate_jwt_keys,
  ).describe('Rotate expired JWT signing keys'),
  cleanup_expired_tokens: SchedulerJobConfig.default(
    DEFAULT_SCHEDULER_JOBS.cleanup_expired_tokens,
  ).describe('Remove expired refresh tokens from database'),
  cleanup_sessions: SchedulerJobConfig.default(
    DEFAULT_SCHEDULER_JOBS.cleanup_sessions,
  ).describe('Clean up expired OAuth sessions'),
  cleanup_deleted_users: SchedulerJobConfig.default(
    DEFAULT_SCHEDULER_JOBS.cleanup_deleted_users,
  ).describe('Permanently delete users after retention period'),
});

export type SchedulerJobsConfig = z.infer<typeof SchedulerJobsConfig>;

/**
 * Scheduler configuration
 *
 * Controls the in-process job scheduler for automated tasks like
 * JWT key rotation, token cleanup, and session management.
 *
 * For Kubernetes deployments, set `enabled: false` and use
 * K8s CronJobs with `tinyauth job <name>` instead.
 */
export const AppConfigScheduler = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe(
      'Enable in-process scheduler. ' +
        'Set to false when using external schedulers like Kubernetes CronJob.',
    ),
  jobs: SchedulerJobsConfig.default(DEFAULT_SCHEDULER_JOBS),
});

export type AppConfigScheduler = z.infer<typeof AppConfigScheduler>;
