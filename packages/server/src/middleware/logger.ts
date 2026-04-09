import { createMiddleware } from 'hono/factory';
import type pino from 'pino';

/**
 * Hono env type that declares the `logger` context variable.
 */
export type LoggerEnv = {
  Variables: {
    logger: pino.Logger;
  };
};

/**
 * Determine the pino log level for a response status code.
 */
function levelForStatus(status: number): pino.Level {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

/**
 * Create the pino logging middleware for Hono.
 *
 * Provides:
 * - Automatic request/response logging (method, path, status, duration)
 * - Per-request `c.var.logger` child logger with request ID
 */
export function loggerMiddleware(rootLogger: pino.Logger) {
  return createMiddleware<LoggerEnv>(async (c, next) => {
    const reqId = crypto.randomUUID();
    const child = rootLogger.child({ reqId });
    c.set('logger', child);

    const start = performance.now();
    await next();
    const responseTime = Math.round(performance.now() - start);

    const path = c.req.path;
    const status = c.res.status;
    const level = levelForStatus(status);
    const msg = `${c.req.method} ${path} ${status}`;

    child[level](
      {
        req: { method: c.req.method, url: path },
        res: { status },
        responseTime,
      },
      msg,
    );
  });
}
