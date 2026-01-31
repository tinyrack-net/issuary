#!/usr/bin/env node
import { Command } from 'commander';
import { jobCommand } from './cli/commands/job.js';
import { serveCommand } from './cli/commands/serve.js';

/**
 * TinyAuth CLI
 *
 * Main entry point for the TinyAuth OIDC Provider.
 *
 * Commands:
 *   serve   Start the TinyAuth server (default)
 *   job     Run a scheduled job once (for K8s CronJob integration)
 *
 * Examples:
 *   tinyauth serve                    # Start server with scheduler
 *   tinyauth job rotate-jwt-keys      # Run JWT key rotation job
 *   tinyauth job --list               # List available jobs
 */
const program = new Command();

program.name('tinyauth').description('TinyAuth OIDC Provider').version('1.0.0');

program.addCommand(serveCommand, { isDefault: true });
program.addCommand(jobCommand);

program.parse();
