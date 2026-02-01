/**
 * Common types for service operations.
 */

/**
 * Result of a cleanup operation.
 */
export interface CleanupResult {
  /** Number of items deleted (or would be deleted in dry-run mode) */
  deletedCount: number;
  /** If true, the cleanup was skipped (e.g., disabled in config) */
  skipped: boolean;
  /** Optional message with additional details */
  message?: string;
}

/**
 * Options for cleanup operations.
 */
export interface CleanupOptions {
  /** If true, don't actually delete anything, just report what would be deleted */
  dryRun: boolean;
}
