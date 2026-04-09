import {
  type LoggingConfig,
  LoggingConfigSchema,
} from '@tinyrack/tinyauth-server/config';
import pino from 'pino';

export type { Logger } from 'pino';

const DEFAULT_LOGGING_CONFIG = LoggingConfigSchema.parse(undefined);

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
