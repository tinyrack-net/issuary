import { serve } from '@hono/node-server';
import { createNodeHonoSqliteExampleApp } from './app.js';

async function main(): Promise<void> {
  const { app, cleanup, logger, services } =
    await createNodeHonoSqliteExampleApp();

  const server = serve(
    {
      fetch: app.fetch,
      port: services.config.app.port,
      hostname: '0.0.0.0',
    },
    (info) => {
      logger.info({ port: info.port }, `Server listening on port ${info.port}`);
    },
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, `Received ${signal}, shutting down...`);
    server.close();
    await cleanup();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
