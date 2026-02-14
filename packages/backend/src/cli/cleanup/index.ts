import type { ServiceContainer } from '@backend/services/container.js';
import type { CleanupResult } from '@backend/services/types.js';

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
 * Run all cleanup tasks via CleanupService.
 *
 * @param services - Service container with all services
 * @param options - Cleanup options (dryRun, verbose)
 * @returns Summary of all task executions
 */
export async function runCleanup(
  services: ServiceContainer,
  options: CleanupOptions,
): Promise<CleanupSummary> {
  return services.cleanupService.runAll({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });
}

export type { CleanupResult } from '@backend/services/types.js';
