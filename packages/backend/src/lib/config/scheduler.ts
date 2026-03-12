import z from 'zod';

export interface SchedulerStartOptions {
  runCleanup: () => Promise<void>;
}

export interface SchedulerHandle {
  stop: () => void | Promise<void>;
  getNextRunAt?: () => Date | null;
}

export interface SchedulerConfig {
  start: (
    options: SchedulerStartOptions,
  ) => SchedulerHandle | Promise<SchedulerHandle>;
}

function isSchedulerConfig(value: unknown): value is SchedulerConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'start' in value && typeof value.start === 'function';
}

export const SchedulerConfigSchema = z
  .custom<SchedulerConfig>(isSchedulerConfig, {
    message: 'Invalid SchedulerConfig: must have a start function',
  })
  .optional()
  .describe('In-process cleanup scheduler adapter.');
