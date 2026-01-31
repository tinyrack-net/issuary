import type { FastifyInstance } from 'fastify';
import { deletedUsersTask } from './deleted-users.js';
import { emailVerificationsTask } from './email-verifications.js';
import { jwtKeysTask } from './jwt-keys.js';
import { oauthCodesTask } from './oauth-codes.js';
import { passwordResetsTask } from './password-resets.js';
import { revokedTokensTask } from './revoked-tokens.js';
import type { CleanupResult, CleanupTask } from './types.js';

/**
 * Registry of all cleanup tasks in execution order
 */
export const cleanupTasks: CleanupTask[] = [
  revokedTokensTask,
  oauthCodesTask,
  emailVerificationsTask,
  passwordResetsTask,
  deletedUsersTask,
  jwtKeysTask,
];

/**
 * Options for running cleanup tasks
 */
export interface CleanupOptions {
  /** If true, don't actually delete anything */
  dryRun: boolean;
  /** If true, log detailed progress */
  verbose: boolean;
}

/**
 * Result of a single task execution
 */
export interface TaskExecutionResult {
  task: CleanupTask;
  result: CleanupResult;
  durationMs: number;
  error?: Error;
}

/**
 * Summary of all cleanup tasks execution
 */
export interface CleanupSummary {
  tasks: TaskExecutionResult[];
  totalDeleted: number;
  totalSkipped: number;
  totalFailed: number;
  totalDurationMs: number;
}

/**
 * Run all cleanup tasks
 *
 * @param fastify - Fastify instance with all services
 * @param options - Cleanup options (dryRun, verbose)
 * @returns Summary of all task executions
 */
export async function runCleanup(
  fastify: FastifyInstance,
  options: CleanupOptions,
): Promise<CleanupSummary> {
  const results: TaskExecutionResult[] = [];
  const startTime = Date.now();

  for (const task of cleanupTasks) {
    const taskStart = Date.now();

    try {
      const result = await task.run({
        fastify,
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      results.push({
        task,
        result,
        durationMs: Date.now() - taskStart,
      });
    } catch (error) {
      results.push({
        task,
        result: {
          deletedCount: 0,
          skipped: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        durationMs: Date.now() - taskStart,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const totalDeleted = results.reduce((sum, r) => {
    if (!r.error && !r.result.skipped) {
      return sum + r.result.deletedCount;
    }
    return sum;
  }, 0);

  const totalSkipped = results.filter((r) => r.result.skipped).length;
  const totalFailed = results.filter((r) => r.error).length;

  return {
    tasks: results,
    totalDeleted,
    totalSkipped,
    totalFailed,
    totalDurationMs: Date.now() - startTime,
  };
}

export type { CleanupContext, CleanupResult, CleanupTask } from './types.js';
