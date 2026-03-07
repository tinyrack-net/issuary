import z from 'zod';

/**
 * Log level values.
 * Maps to pino log levels.
 */
const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Log format values.
 * - 'json': Structured JSON output (default)
 * - 'pretty': Human-readable pretty-printed output
 */
const LOG_FORMATS = ['json', 'pretty'] as const;

export type LogFormat = (typeof LOG_FORMATS)[number];

/**
 * Default logging configuration.
 */
export const DEFAULT_LOGGING_CONFIG = {
  level: 'info',
  format: 'json',
  http_log_proxy: false,
} as const;

/**
 * Logging configuration schema.
 *
 * Controls the log level and output format.
 * Configured via config file only (no environment variable override).
 */
export const LoggingConfigSchema = z
  .object({
    level: z
      .enum(LOG_LEVELS)
      .default(DEFAULT_LOGGING_CONFIG.level)
      .describe('Log level.'),
    format: z
      .enum(LOG_FORMATS)
      .default(DEFAULT_LOGGING_CONFIG.format)
      .describe(
        'Log output format. ' +
          '"json" outputs structured JSON (default). ' +
          '"pretty" outputs human-readable format.',
      ),
    http_log_proxy: z
      .boolean()
      .default(DEFAULT_LOGGING_CONFIG.http_log_proxy)
      .describe(
        'Whether to log HTTP access logs for proxied frontend requests ' +
          'in development mode. When false (default), proxy requests ' +
          'are completely suppressed, keeping the terminal clean. ' +
          'Set to true to see them.',
      ),
  })
  .describe('Logging configuration');

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
