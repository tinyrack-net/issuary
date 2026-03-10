import pino from 'pino';
import {
  type LoggingConfig,
  LoggingConfigSchema,
} from '#backend/lib/config/index.js';

export type { Logger } from 'pino';

export interface CreateLoggerOptions {
  logging?: Partial<LoggingConfig> | undefined;
}

/**
 * Create the root pino logger instance.
 *
 * @param options - Logging configuration (all fields optional)
 * @returns A configured pino logger
 */
export function createLogger(options?: CreateLoggerOptions): pino.Logger {
  const logging = LoggingConfigSchema.parse({
    ...options?.logging,
  });

  const pinoOptions: pino.LoggerOptions = {
    level: logging.level,
    redact: {
      paths: [
        'password',
        'client_secret',
        'security.session_secret',
        'security.hash_secret',
        'config.security.session_secret',
        'config.security.hash_secret',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  };

  if (logging.format === 'pretty') {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(pinoOptions);
}
