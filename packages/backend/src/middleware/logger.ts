import { createMiddleware } from 'hono/factory';
import type pino from 'pino';
import { isBackendRoute } from '#backend/lib/is-backend-route.js';

/**
 * Hono env type that declares the `logger` context variable.
 */
export type LoggerEnv = {
  Variables: {
    logger: pino.Logger;
  };
};

export interface LoggerMiddlewareOptions {
  /**
   * Whether to log HTTP access logs for proxied frontend
   * requests (non-backend routes).
   *
   * When false (default), proxy requests are completely
   * suppressed from HTTP access logs, keeping the terminal
   * clean during development. Set to true to log them
   * at normal levels.
   *
   * Only relevant in development mode where a frontend
   * dev server proxy is active.
   */
  httpLogProxy?: boolean | undefined;
}

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
 * - Optional suppression of proxy request logs
 */
export function loggerMiddleware(
  rootLogger: pino.Logger,
  options?: LoggerMiddlewareOptions,
) {
  const logProxy = options?.httpLogProxy ?? false;

  return createMiddleware<LoggerEnv>(async (c, next) => {
    const reqId = crypto.randomUUID();
    const child = rootLogger.child({ reqId });
    c.set('logger', child);

    const start = performance.now();
    await next();
    const responseTime = Math.round(performance.now() - start);

    // Determine whether this request should be logged.
    const path = c.req.path;
    if (!logProxy && !isBackendRoute(path)) {
      return;
    }

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
