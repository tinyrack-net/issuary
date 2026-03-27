import { serve } from '@hono/node-server';
import { createNodeHonoSqliteExampleApp } from './app.ts';

const { app, cleanup, logger, services } =
  await createNodeHonoSqliteExampleApp();

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

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, `Received ${signal}, shutting down...`);
    server.close();
    void cleanup().then(() => process.exit(0));
  });
}
