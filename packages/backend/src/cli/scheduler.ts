import { Cron } from 'croner';
import type { FastifyInstance } from 'fastify';
import type { AppConfigScheduler } from '@/lib/config/schemas/scheduler.js';
import {
  configKeyToJobName,
  getJob,
  type Job,
  jobNameToConfigKey,
} from './jobs/index.js';

/**
 * Active cron job instances
 */
const activeJobs: Map<string, Cron> = new Map();

/**
 * Start the in-process scheduler
 *
 * Registers cron jobs based on the scheduler configuration.
 * Each job runs in the context of the Fastify instance with
 * access to all services and repositories.
 *
 * @param fastify - Fastify instance
 */
export async function startScheduler(fastify: FastifyInstance): Promise<void> {
  const config = fastify.config.scheduler;

  if (!config.enabled) {
    fastify.log.info('Scheduler is disabled in config');
    return;
  }

  fastify.log.info('Starting in-process job scheduler');

  // Register each configured job
  for (const [configKey, jobConfig] of Object.entries(config.jobs)) {
    const jobName = configKeyToJobName(configKey);
    const job = getJob(jobName);

    if (!job) {
      fastify.log.warn({ jobName }, 'Unknown job in scheduler config');
      continue;
    }

    if (!jobConfig.enabled) {
      fastify.log.debug({ jobName }, 'Job is disabled, skipping');
      continue;
    }

    registerJob(fastify, job, jobConfig.cron);
  }

  // Register cleanup on server close
  fastify.addHook('onClose', async () => {
    await stopScheduler(fastify);
  });

  fastify.log.info(
    { activeJobs: activeJobs.size },
    'Scheduler started with registered jobs',
  );
}

/**
 * Register a single job with the scheduler
 *
 * @param fastify - Fastify instance
 * @param job - Job definition
 * @param cronExpression - Cron expression for scheduling
 */
function registerJob(
  fastify: FastifyInstance,
  job: Job,
  cronExpression: string,
): void {
  const cronJob = new Cron(cronExpression, async () => {
    fastify.log.info({ job: job.name }, 'Running scheduled job');

    try {
      await job.run(fastify);
      fastify.log.info({ job: job.name }, 'Scheduled job completed');
    } catch (error) {
      fastify.log.error({ job: job.name, error }, 'Scheduled job failed');
    }
  });

  activeJobs.set(job.name, cronJob);

  const nextRun = cronJob.nextRun();
  fastify.log.info(
    {
      job: job.name,
      cron: cronExpression,
      nextRun: nextRun?.toISOString(),
    },
    'Registered scheduled job',
  );
}

/**
 * Stop all scheduled jobs
 *
 * @param fastify - Fastify instance
 */
export async function stopScheduler(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('Stopping scheduler');

  for (const [name, cronJob] of activeJobs) {
    cronJob.stop();
    fastify.log.debug({ job: name }, 'Stopped scheduled job');
  }

  activeJobs.clear();
  fastify.log.info('Scheduler stopped');
}

/**
 * Get scheduler status
 *
 * @param config - Scheduler configuration
 * @returns Status information for all jobs
 */
export function getSchedulerStatus(config: AppConfigScheduler): {
  enabled: boolean;
  jobs: Array<{
    name: string;
    enabled: boolean;
    cron: string;
    nextRun: Date | null;
    isRunning: boolean;
  }>;
} {
  const jobs: Array<{
    name: string;
    enabled: boolean;
    cron: string;
    nextRun: Date | null;
    isRunning: boolean;
  }> = [];

  for (const [configKey, jobConfig] of Object.entries(config.jobs)) {
    const jobName = configKeyToJobName(configKey);
    const cronJob = activeJobs.get(jobName);

    jobs.push({
      name: jobName,
      enabled: jobConfig.enabled,
      cron: jobConfig.cron,
      nextRun: cronJob?.nextRun() ?? null,
      isRunning: cronJob?.isBusy() ?? false,
    });
  }

  return {
    enabled: config.enabled,
    jobs,
  };
}

/**
 * Run a job immediately (outside of schedule)
 *
 * Used by the CLI 'job' command for one-off execution.
 *
 * @param fastify - Fastify instance
 * @param jobName - Name of the job to run
 * @throws Error if job is not found
 */
export async function runJobOnce(
  fastify: FastifyInstance,
  jobName: string,
): Promise<void> {
  const job = getJob(jobName);

  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  // Check if job is enabled in config (for CLI runs, we still run it
  // but log a warning if disabled)
  const configKey = jobNameToConfigKey(jobName);
  const jobsConfig = fastify.config.scheduler.jobs;
  const jobConfig = jobsConfig[configKey as keyof typeof jobsConfig];

  if (jobConfig && !jobConfig.enabled) {
    fastify.log.warn(
      { job: jobName },
      'Running disabled job via CLI (job is disabled in scheduler config)',
    );
  }

  fastify.log.info({ job: jobName }, 'Running job once via CLI');

  try {
    await job.run(fastify);
    fastify.log.info({ job: jobName }, 'Job completed successfully');
  } catch (error) {
    fastify.log.error({ job: jobName, error }, 'Job failed');
    throw error;
  }
}
