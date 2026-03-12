import z from 'zod';
import { StandaloneBooleanSchema } from './coerce.js';

const CronExpressionSchema = z
  .string()
  .min(9)
  .describe('Cron expression in 5-field format.');

export const STANDALONE_SCHEDULER_CONFIG_DEFAULT = {
  enabled: true,
  cron: '0 2 * * *',
};

export const StandaloneSchedulerConfigSchema = z
  .object({
    enabled: StandaloneBooleanSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.enabled,
    ).describe(
      'Enable in-process cleanup scheduler. Disable when using external schedulers.',
    ),
    cron: CronExpressionSchema.default(
      STANDALONE_SCHEDULER_CONFIG_DEFAULT.cron,
    ).describe('Cron schedule for running all cleanup tasks.'),
  })
  .strict()
  .default(STANDALONE_SCHEDULER_CONFIG_DEFAULT)
  .describe('Standalone in-process cleanup scheduler configuration.');

export type StandaloneSchedulerConfig = z.infer<
  typeof StandaloneSchedulerConfigSchema
>;
