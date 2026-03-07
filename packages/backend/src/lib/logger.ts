import pino from 'pino';
import {
  DEFAULT_LOGGING_CONFIG,
  type LoggingConfig,
} from '#backend/lib/config/index.js';

export type { Logger } from 'pino';

export interface CreateLoggerOptions {
  logging?: Partial<LoggingConfig> | undefined;
}

/**
 * Create the root pino logger instance.
 *
 * Any omitted logging fields fall back to
 * {@link DEFAULT_LOGGING_CONFIG} defaults.
 *
 * @param options - Logging configuration (all fields optional)
 * @returns A configured pino logger
 */
export function createLogger(options?: CreateLoggerOptions): pino.Logger {
  const logging = {
    ...DEFAULT_LOGGING_CONFIG,
    ...options?.logging,
  };

  const pinoOptions: pino.LoggerOptions = {
    level: logging.level,
    redact: {
      paths: [
        'password',
        'client_secret',
        'cookie_secret',
        'hash_master_secret',
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
