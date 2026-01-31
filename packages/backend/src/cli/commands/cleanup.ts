import { Command } from 'commander';
import { createServer } from '../../server.js';
import { runCleanup } from '../cleanup/index.js';

/**
 * Cleanup command
 *
 * Run all cleanup tasks to maintain database health.
 * Designed for use with Kubernetes CronJobs.
 *
 * Usage:
 *   tinyauth cleanup              # Run all cleanup tasks
 *   tinyauth cleanup --dry-run    # Show what would be cleaned
 *   tinyauth cleanup --verbose    # Show detailed progress
 */
export const cleanupCommand = new Command('cleanup')
  .description('Run all cleanup and maintenance tasks')
  .option('-n, --dry-run', 'Show what would be cleaned without deleting', false)
  .option('-v, --verbose', 'Show detailed progress for each task', false)
  .action(async (options: { dryRun: boolean; verbose: boolean }) => {
    const { dryRun, verbose } = options;

    // Print header
    console.log('');
    console.log('TinyAuth Cleanup');
    console.log('================');
    if (dryRun) {
      console.log('[DRY RUN] No changes will be made');
    }
    console.log('');

    // Create server without listening (for cleanup only)
    if (verbose) {
      console.log('Initializing server...');
    }

    let app: Awaited<ReturnType<typeof createServer>> | undefined;
    try {
      app = await createServer({ skipListen: true });
    } catch (error) {
      console.error('Failed to initialize server:', error);
      process.exit(1);
    }

    try {
      const summary = await runCleanup(app, { dryRun, verbose });

      // Print results for each task
      const totalTasks = summary.tasks.length;
      for (let i = 0; i < summary.tasks.length; i++) {
        const taskResult = summary.tasks[i];
        if (!taskResult) continue;
        const { task, result, error, durationMs } = taskResult;
        const index = i + 1;

        if (error) {
          console.log(`[${index}/${totalTasks}] ${task.description}`);
          console.log(`      ERROR: ${error.message}`);
        } else if (result.skipped) {
          if (verbose) {
            console.log(`[${index}/${totalTasks}] ${task.description}`);
            console.log(`      Skipped: ${result.message || 'Disabled'}`);
          }
        } else {
          console.log(`[${index}/${totalTasks}] ${task.description}`);
          if (result.deletedCount > 0) {
            const action = dryRun ? 'Would delete' : 'Deleted';
            const suffix = result.message ? ` (${result.message})` : '';
            console.log(`      ${action}: ${result.deletedCount}${suffix}`);
          } else {
            console.log(`      ${result.message || 'Nothing to clean'}`);
          }

          if (verbose) {
            console.log(`      Duration: ${durationMs}ms`);
          }
        }
      }

      // Print summary
      console.log('');
      console.log('-'.repeat(40));

      if (dryRun) {
        console.log(`Summary: ${summary.totalDeleted} items would be cleaned`);
      } else {
        console.log(`Summary: ${summary.totalDeleted} items cleaned`);
      }

      if (summary.totalSkipped > 0 && verbose) {
        console.log(`         ${summary.totalSkipped} tasks skipped`);
      }

      if (summary.totalFailed > 0) {
        console.log(`         ${summary.totalFailed} tasks failed`);
      }

      console.log(`Duration: ${summary.totalDurationMs}ms`);
      console.log('');

      // Exit with error code if any task failed
      if (summary.totalFailed > 0) {
        await app.close();
        process.exit(1);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      await app.close();
      process.exit(1);
    }

    // Graceful shutdown
    await app.close();
    process.exit(0);
  });
