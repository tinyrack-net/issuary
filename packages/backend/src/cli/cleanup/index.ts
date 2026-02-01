import type { FastifyInstance } from 'fastify';
import type { CleanupResult } from '@/services/types.js';

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
 * Cleanup task definition
 */
interface CleanupTask {
  /** Unique task identifier (kebab-case) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Execute the cleanup task */
  run: () => Promise<CleanupResult>;
}

/**
 * Result of a single task execution
 */
export interface TaskExecutionResult {
  name: string;
  description: string;
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
 * Build cleanup tasks from services
 */
function buildCleanupTasks(
  fastify: FastifyInstance,
  dryRun: boolean,
): CleanupTask[] {
  return [
    {
      name: 'revoked-tokens',
      description: 'Remove expired revoked tokens',
      run: () => fastify.jwtService.cleanupRevokedTokens({ dryRun }),
    },
    {
      name: 'oauth-codes',
      description: 'Remove expired and consumed OAuth authorization codes',
      run: () => fastify.oauthTokenService.cleanupExpiredCodes({ dryRun }),
    },
    {
      name: 'email-verifications',
      description: 'Remove expired email verification tokens',
      run: () =>
        fastify.emailVerificationService?.cleanupExpired({ dryRun }) ??
        Promise.resolve({
          deletedCount: 0,
          skipped: true,
          message: 'Service not available',
        }),
    },
    {
      name: 'password-resets',
      description: 'Remove expired password reset tokens',
      run: () => fastify.passwordResetService.cleanupExpired({ dryRun }),
    },
    {
      name: 'deleted-users',
      description: 'Permanently delete users after retention period',
      run: () => fastify.userService.purgeDeletedUsers({ dryRun }),
    },
    {
      name: 'jwt-keys',
      description: 'Rotate expired JWT signing keys',
      run: () => fastify.jwtKeyService.rotateExpiredKeys({ dryRun }),
    },
  ];
}

/**
 * Run all cleanup tasks via their respective services.
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

  const tasks = buildCleanupTasks(fastify, options.dryRun);

  for (const task of tasks) {
    const taskStart = Date.now();

    try {
      const result = await task.run();

      results.push({
        name: task.name,
        description: task.description,
        result,
        durationMs: Date.now() - taskStart,
      });
    } catch (error) {
      results.push({
        name: task.name,
        description: task.description,
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

export type { CleanupResult } from '@/services/types.js';
