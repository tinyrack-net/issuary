import { Command } from 'commander';
import { createServer } from '../../server.js';
import { getAllJobs, getJob } from '../jobs/index.js';
import { runJobOnce } from '../scheduler.js';

/**
 * Job command
 *
 * Run scheduled jobs manually. Useful for:
 * - Kubernetes CronJobs (run a specific job on schedule)
 * - Manual maintenance tasks
 * - Testing job execution
 *
 * Usage:
 *   tinyauth job --list              # List all available jobs
 *   tinyauth job rotate-jwt-keys     # Run a specific job
 */
export const jobCommand = new Command('job')
  .description('Run a scheduled job once')
  .argument('[name]', 'Job name to run')
  .option('-l, --list', 'List all available jobs')
  .action(async (name: string | undefined, options: { list?: boolean }) => {
    // Handle --list option
    if (options.list) {
      listJobs();
      return;
    }

    // Require job name if not listing
    if (!name) {
      console.error('Error: Job name is required');
      console.error('Usage: tinyauth job <name>');
      console.error('Run "tinyauth job --list" to see available jobs');
      process.exit(1);
    }

    // Validate job exists
    const job = getJob(name);
    if (!job) {
      console.error(`Error: Unknown job "${name}"`);
      console.error('Run "tinyauth job --list" to see available jobs');
      process.exit(1);
    }

    // Create server without listening (for job execution only)
    console.log(`Initializing server for job execution...`);
    const app = await createServer({ skipListen: true });

    try {
      console.log(`Running job: ${name}`);
      await runJobOnce(app, name);
      console.log(`Job "${name}" completed successfully`);
    } catch (error) {
      console.error(`Job "${name}" failed:`, error);
      await app.close();
      process.exit(1);
    }

    // Graceful shutdown
    await app.close();
    process.exit(0);
  });

/**
 * Print list of available jobs to console
 */
function listJobs(): void {
  const jobs = getAllJobs();

  console.log('\nAvailable jobs:\n');
  console.log(
    '  ' + 'NAME'.padEnd(25) + 'DEFAULT CRON'.padEnd(20) + 'DESCRIPTION',
  );
  console.log('  ' + '-'.repeat(70));

  for (const job of jobs) {
    console.log(
      '  ' + job.name.padEnd(25) + job.defaultCron.padEnd(20) + job.description,
    );
  }

  console.log('\nUsage:');
  console.log('  tinyauth job <name>    Run a job once');
  console.log('');
}
