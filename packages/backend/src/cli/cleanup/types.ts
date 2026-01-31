import type { FastifyInstance } from 'fastify';

/**
 * Context passed to each cleanup task
 */
export interface CleanupContext {
  /** Fastify instance with all services available */
  fastify: FastifyInstance;
  /** If true, don't actually delete anything, just report what would be deleted */
  dryRun: boolean;
  /** If true, log detailed progress */
  verbose: boolean;
}

/**
 * Result returned by a cleanup task
 */
export interface CleanupResult {
  /** Number of items deleted (or would be deleted in dry-run mode) */
  deletedCount: number;
  /** If true, the task was skipped (e.g., disabled in config) */
  skipped: boolean;
  /** Optional message with additional details */
  message?: string;
}

/**
 * A cleanup task that can be executed
 */
export interface CleanupTask {
  /** Unique task identifier (kebab-case) */
  name: string;
  /** Human-readable description */
  description: string;
  /**
   * Execute the cleanup task
   * @param ctx - Cleanup context with fastify instance and options
   * @returns Promise with cleanup result
   */
  run(ctx: CleanupContext): Promise<CleanupResult>;
}
