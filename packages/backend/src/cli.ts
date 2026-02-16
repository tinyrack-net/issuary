#!/usr/bin/env node
import { Command } from 'commander';
import { cleanupCommand } from './cli/commands/cleanup.js';
import { serveCommand } from './cli/commands/serve.js';

/**
 * TinyAuth CLI
 *
 * Main entry point for the TinyAuth OIDC Provider.
 *
 * Commands:
 *   serve     Start the TinyAuth server (default)
 *   cleanup   Run all cleanup and maintenance tasks (for K8s CronJob)
 *
 * Examples:
 *   tinyauth serve                    # Start server
 *   tinyauth cleanup                  # Run all cleanup tasks
 *   tinyauth cleanup --dry-run        # Show what would be cleaned
 *   tinyauth cleanup --verbose        # Show detailed progress
 */
const program = new Command();

program.name('tinyauth').description('TinyAuth OIDC Provider').version('1.0.0');

program.addCommand(serveCommand, { isDefault: true });
program.addCommand(cleanupCommand);

program.parse();
