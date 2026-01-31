import type { FastifyInstance } from 'fastify';
import { cleanupDeletedUsersJob } from './cleanup-deleted-users.js';
import { cleanupExpiredTokensJob } from './cleanup-expired-tokens.js';
import { cleanupSessionsJob } from './cleanup-sessions.js';
import { rotateJwtKeysJob } from './rotate-jwt-keys.js';

/**
 * Job interface for scheduled tasks
 */
export interface Job {
  /** Unique job identifier (kebab-case) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Default cron expression */
  defaultCron: string;
  /**
   * Execute the job
   * @param fastify - Fastify instance with all services available
   * @returns Promise that resolves when job completes
   */
  run: (fastify: FastifyInstance) => Promise<void>;
}

/**
 * Registry of all available scheduled jobs
 *
 * Job names must match the keys in scheduler.jobs config
 * (with hyphens converted to underscores)
 */
export const jobs: Record<string, Job> = {
  'rotate-jwt-keys': rotateJwtKeysJob,
  'cleanup-expired-tokens': cleanupExpiredTokensJob,
  'cleanup-sessions': cleanupSessionsJob,
  'cleanup-deleted-users': cleanupDeletedUsersJob,
};

/**
 * Get a job by name
 * @param name - Job name (kebab-case)
 * @returns Job or undefined if not found
 */
export function getJob(name: string): Job | undefined {
  return jobs[name];
}

/**
 * Get all registered jobs
 * @returns Array of all jobs
 */
export function getAllJobs(): Job[] {
  return Object.values(jobs);
}

/**
 * Convert job name to config key
 * @param name - Job name (kebab-case)
 * @returns Config key (snake_case)
 */
export function jobNameToConfigKey(name: string): string {
  return name.replace(/-/g, '_');
}

/**
 * Convert config key to job name
 * @param key - Config key (snake_case)
 * @returns Job name (kebab-case)
 */
export function configKeyToJobName(key: string): string {
  return key.replace(/_/g, '-');
}
