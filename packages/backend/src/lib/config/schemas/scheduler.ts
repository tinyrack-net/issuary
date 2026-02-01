import z from 'zod/v4';

/**
 * Cron expression string.
 * Accepts standard 5-field cron format: minute hour day month weekday
 * Supports: numbers, ranges (1-5), lists (1,3,5), steps, wildcards
 * Examples: "0 2 * * *" (daily at 2 AM), "0 0/6 * * *" (every 6 hours)
 *
 * Note: Full validation is done by croner at runtime.
 */
const CronExpression = z
  .string()
  .min(9) // Minimum valid cron: "* * * * *"
  .describe('Cron expression in 5-field format');

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG = {
  enabled: true,
  cron: '0 2 * * *', // Daily at 2 AM
} as const;

/**
 * In-process scheduler configuration.
 *
 * The scheduler runs cleanup tasks automatically on a cron schedule.
 * This is useful for single Docker container deployments.
 *
 * For Kubernetes deployments, disable the scheduler and use CronJobs
 * to run `tinyauth cleanup` externally.
 */
export const AppConfigScheduler = z
  .object({
    enabled: z
      .boolean()
      .optional()
      .default(DEFAULT_SCHEDULER_CONFIG.enabled)
      .describe(
        'Enable in-process cleanup scheduler. Disable when using external schedulers (K8s CronJob).',
      ),
    cron: CronExpression.optional()
      .default(DEFAULT_SCHEDULER_CONFIG.cron)
      .describe(
        'Cron schedule for running all cleanup tasks. Default: daily at 2 AM.',
      ),
  })
  .describe('In-process scheduler configuration for automated cleanup tasks');

export type AppConfigScheduler = z.infer<typeof AppConfigScheduler>;
