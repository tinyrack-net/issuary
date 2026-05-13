import z from 'zod';
import type { MikroService } from '../../services/mikro.service.ts';
import type { Logger } from '../logger.ts';

export type JobPayload =
  | null
  | boolean
  | number
  | string
  | readonly JobPayload[]
  | { readonly [key: string]: JobPayload };

export interface JobRunContext {
  logger?: Logger | undefined;
  signal?: AbortSignal | undefined;
}

export interface CronJobSchedule {
  type: 'cron';
  expression: string;
}

export interface ScheduledJobConfig {
  id: string;
  name: string;
  schedule: CronJobSchedule;
  handler: (context: JobRunContext) => Promise<void>;
}

export interface BackgroundJobConfig<TPayload extends JobPayload = JobPayload> {
  id: string;
  name: string;
  handler: (payload: TPayload, context: JobRunContext) => Promise<void>;
}

export interface EnqueueBackgroundJobOptions<
  TPayload extends JobPayload = JobPayload,
> {
  jobId: string;
  payload: TPayload;
  runAt?: Date | undefined;
}

export interface SchedulerStartOptions {
  scheduledJobs: readonly ScheduledJobConfig[];
  backgroundJobs: readonly BackgroundJobConfig[];
  logger?: Logger;
}

export interface SchedulerHandle {
  stop: () => void | Promise<void>;
  getNextRunAt?: () => Date | null;
  enqueue?: <TPayload extends JobPayload>(
    options: EnqueueBackgroundJobOptions<TPayload>,
  ) => Promise<string>;
}

export interface SchedulerConfig {
  cleanupCron?: string | undefined;
  start: (
    options: SchedulerStartOptions,
  ) => SchedulerHandle | Promise<SchedulerHandle>;
}

export interface SchedulerRuntimeContext {
  mikro: MikroService;
}

export type SchedulerConfigResolver = (
  context: SchedulerRuntimeContext,
) => SchedulerConfig;

export type SchedulerRuntimeConfig = SchedulerConfig | SchedulerConfigResolver;

function isSchedulerConfig(value: unknown): value is SchedulerConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'start' in value && typeof value.start === 'function';
}

export function isSchedulerConfigResolver(
  value: SchedulerRuntimeConfig,
): value is SchedulerConfigResolver {
  return typeof value === 'function';
}

function isSchedulerRuntimeConfig(
  value: unknown,
): value is SchedulerRuntimeConfig {
  return isSchedulerConfig(value) || typeof value === 'function';
}

export const SchedulerConfigSchema = z
  .custom<SchedulerRuntimeConfig>(isSchedulerRuntimeConfig, {
    message: 'Invalid SchedulerConfig: must have a start function or resolver',
  })
  .optional()
  .describe('Scheduler adapter.');
