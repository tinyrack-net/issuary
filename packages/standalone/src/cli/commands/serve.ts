import { serve } from '@hono/node-server';
import { buildCommand } from '@stricli/core';
import { createAdminApp } from '@tinyrack/tinyauth-server';
import z from 'zod';
import { createStandaloneApp } from '../../app.ts';
import { parseWithZod } from '../../lib/cli/parse-with-zod.ts';
import { loadConfig } from '../../lib/load-config.ts';

/**
 * Serve command
 *
 * Starts the TinyAuth server with all middleware,
 * services, and routes.
 *
 * For maintenance tasks like cleanup and key rotation,
 * run: `tinyauth cleanup` as a separate process or
 * Kubernetes CronJob.
 */
type ServeFlags = {
  configPath?: string;
};

const configPathSchema = z.string().trim().min(1, 'must not be empty');

export async function runServeCommand(flags: ServeFlags): Promise<void> {
  const config = loadConfig(flags.configPath);
  const { app, cleanup, services, logger } = await createStandaloneApp({
    config,
  });

  const server = serve(
    {
      fetch: app.fetch,
      port: services.config.server.listen_port,
      hostname: '0.0.0.0',
    },
    (info) => {
      logger.info({ port: info.port }, `Server listening on port ${info.port}`);
    },
  );
  const servers = [server];

  if (
    services.config.admin.enabled &&
    services.config.admin.mode === 'separate-port'
  ) {
    const adminListenPort = services.config.admin.listen_port;
    if (adminListenPort === undefined) {
      throw new Error('Admin separate-port mode requires listen_port.');
    }

    const adminApp = createAdminApp({
      config: services.config,
      services,
    });
    const adminServer = serve(
      {
        fetch: adminApp.fetch,
        port: adminListenPort,
        hostname: services.config.admin.bind_host,
      },
      (info) => {
        logger.info(
          { host: services.config.admin.bind_host, port: info.port },
          `Admin server listening on ${services.config.admin.bind_host}:${info.port}`,
        );
      },
    );
    servers.push(adminServer);
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, `Received ${signal}, shutting down...`);
    for (const runningServer of servers) {
      runningServer.close();
    }
    await cleanup();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export const serveCommand = buildCommand<ServeFlags>({
  parameters: {
    flags: {
      configPath: {
        kind: 'parsed',
        brief: 'Path to config file',
        optional: true,
        parse: async (input) =>
          await parseWithZod(input, {
            label: 'config-path',
            schema: configPathSchema,
          }),
      },
    },
    aliases: {
      c: 'configPath',
    },
  },
  docs: {
    brief: 'Start the TinyAuth server',
    fullDescription: 'Start the TinyAuth server',
  },
  func: runServeCommand,
});

export default serveCommand;
