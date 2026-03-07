import {
  DEFAULT_LOGGING_CONFIG,
  type LoggingConfig,
} from '@tinyauth/backend/config';
import pino from 'pino';

export type { Logger } from 'pino';

export interface CreateLoggerOptions {
  logging?: Partial<LoggingConfig> | undefined;
}

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
