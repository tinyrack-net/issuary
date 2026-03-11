import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

/**
 * Cron expression string.
 * Accepts standard 5-field cron format: minute hour day month weekday
 * Supports: numbers, ranges (1-5), lists (1,3,5), steps, wildcards
 * Examples: "0 2 * * *" (daily at 2 AM), "0 0/6 * * *" (every 6 hours)
 *
 * Note: Full validation is done by croner at runtime.
 */
const CronExpressionSchema = z
  .string()
  .min(9) // Minimum valid cron: "* * * * *"
  .describe('Cron expression in 5-field format');

/**
 * Default scheduler configuration
 */
export const SCHEDULER_CONFIG_DEFAULT = {
  enabled: true,
  cron: '0 2 * * *', // Daily at 2 AM
};

/**
 * In-process scheduler configuration.
 *
 * The scheduler runs cleanup tasks automatically on a cron schedule.
 * This is useful for single Docker container deployments.
 *
 * For Kubernetes deployments, disable the scheduler and use CronJobs
 * to run `tinyauth cleanup` externally.
 */
export const SchedulerConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      SCHEDULER_CONFIG_DEFAULT.enabled,
    ).describe(
      'Enable in-process cleanup scheduler. Disable when using external schedulers (K8s CronJob).',
    ),
    cron: CronExpressionSchema.default(SCHEDULER_CONFIG_DEFAULT.cron).describe(
      'Cron schedule for running all cleanup tasks. Default: daily at 2 AM.',
    ),
  })
  .strict()
  .default(SCHEDULER_CONFIG_DEFAULT)
  .describe('In-process scheduler configuration for automated cleanup tasks');

export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;
