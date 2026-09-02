import { createServer as createHttpServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import type { CreateAppRuntimeOptions } from '@tinyrack/issuary-server';
import { createServer as createViteServer } from 'vite';
import { createStandaloneApp } from './app.js';
import { loadConfig } from './lib/load-config.js';

const REACT_ROUTER_SERVER_BUILD = 'virtual:react-router/server-build';
const frontendDirectory = fileURLToPath(
  new URL('../../frontend/', import.meta.url),
);
const frontendViteConfigPath = fileURLToPath(
  new URL('../../frontend/vite.config.ts', import.meta.url),
);
const developmentConfigPath = fileURLToPath(
  new URL('../config.dev.yaml', import.meta.url),
);
type ReactRouterRuntimeOptions = NonNullable<
  CreateAppRuntimeOptions['reactRouter']
>;
type ServerBuild = Awaited<
  ReturnType<ReactRouterRuntimeOptions['loadServerBuild']>
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isServerBuild(value: unknown): value is ServerBuild {
  if (!isRecord(value)) return false;
  const entry = value['entry'];
  return (
    isRecord(entry) &&
    isRecord(entry['module']) &&
    typeof entry['module']['default'] === 'function' &&
    isRecord(value['routes']) &&
    isRecord(value['assets']) &&
    typeof value['publicPath'] === 'string'
  );
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '0.0.0.0');
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

async function main(): Promise<void> {
  const httpServer = createHttpServer();
  const vite = await createViteServer({
    appType: 'custom',
    configFile: frontendViteConfigPath,
    root: frontendDirectory,
    server: {
      middlewareMode: { server: httpServer },
    },
  });

  try {
    const runtime = await createStandaloneApp({
      config: loadConfig(developmentConfigPath),
      runtimeOptions: {
        reactRouter: {
          loadServerBuild: async () => {
            const build = await vite.ssrLoadModule(REACT_ROUTER_SERVER_BUILD);
            if (!isServerBuild(build)) {
              throw new TypeError(
                'React Router returned an invalid server build.',
              );
            }
            return build;
          },
        },
      },
    });
    const honoRequestListener = getRequestListener(runtime.app.fetch, {
      hostname: '0.0.0.0',
      overrideGlobalObjects: false,
    });
    httpServer.on('request', (request, response) => {
      const handleError = (error: unknown) => {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        vite.ssrFixStacktrace(normalizedError);
        runtime.logger.error(
          { err: normalizedError },
          'Development request failed',
        );
        if (response.headersSent) {
          response.destroy(normalizedError);
          return;
        }
        response.statusCode = 500;
        response.end('Internal Server Error');
      };
      vite.middlewares(request, response, (error: unknown) => {
        if (error !== undefined) {
          handleError(error);
          return;
        }
        void honoRequestListener(request, response).catch(handleError);
      });
    });

    await listen(httpServer, runtime.services.config.server.listen_port);
    runtime.logger.info(
      { port: runtime.services.config.server.listen_port },
      `Development server listening on port ${runtime.services.config.server.listen_port}`,
    );

    let shutdownPromise: Promise<void> | undefined;
    const shutdown = (signal: string): Promise<void> => {
      shutdownPromise ??= (async () => {
        runtime.logger.info({ signal }, `Received ${signal}, shutting down...`);
        const httpClose = close(httpServer);
        await vite.close();
        await httpClose;
        await runtime.cleanup();
      })();
      return shutdownPromise;
    };
    const handleSignal = (signal: string) => {
      void shutdown(signal).catch((error: unknown) => {
        runtime.logger.error(
          { err: error },
          'Development server shutdown failed',
        );
        process.exitCode = 1;
      });
    };
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
  } catch (error) {
    await vite.close();
    throw error;
  }
}

await main();
