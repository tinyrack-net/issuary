import { Cron } from 'croner';
import z from 'zod';
import { StandaloneBooleanSchema } from './coerce.ts';

const PositiveIntegerSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  })
  .pipe(z.number().int().positive());

function isValidCronExpression(expression: string): boolean {
  let job: Cron | undefined;
  try {
    job = new Cron(expression, { paused: true });
    return job.nextRun(new Date()) !== null;
  } catch {
    return false;
  } finally {
    job?.stop();
  }
}

const CronExpressionSchema = z
  .string()
  .min(9)
  .refine(isValidCronExpression, 'Invalid cron expression')
  .describe('Cron expression in 5-field format.');

interface StandaloneSchedulerConfigDefault {
  enabled: boolean;
  mode: 'croner' | 'database';
  cleanup_cron: string;
  poll_interval_ms: number;
  lock_ttl_ms: number;
}

export const STANDALONE_SCHEDULER_CONFIG_DEFAULT: StandaloneSchedulerConfigDefault =
  {
    enabled: true,
    mode: 'croner',
    cleanup_cron: '0 2 * * *',
    poll_interval_ms: 5000,
    lock_ttl_ms: 60000,
  };

export const StandaloneSchedulerConfigSchema = z
  .object({
    enabled: StandaloneBooleanSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.enabled,
    ).describe(
      'Enable internal application job scheduler. Disable when using external schedulers.',
    ),
    mode: z
      .enum(['croner', 'database'])
      .default(STANDALONE_SCHEDULER_CONFIG_DEFAULT.mode)
      .describe('Scheduler mode: croner for single-node, database for HA.'),
    cleanup_cron: CronExpressionSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.cleanup_cron,
    ).describe('Cron schedule for the built-in cleanup job.'),
    poll_interval_ms: PositiveIntegerSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.poll_interval_ms,
    ).describe('Database scheduler polling interval in milliseconds.'),
    lock_ttl_ms: PositiveIntegerSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.lock_ttl_ms,
    ).describe('Database scheduler lease duration in milliseconds.'),
    instance_id: z
      .string()
      .transform((value) => (value === '' ? undefined : value))
      .optional()
      .describe('Optional stable database scheduler instance id.'),
  })
  .strict()
  .default(STANDALONE_SCHEDULER_CONFIG_DEFAULT)
  .describe('Standalone internal application job scheduler configuration.');

export type StandaloneSchedulerConfig = z.infer<
  typeof StandaloneSchedulerConfigSchema
>;
