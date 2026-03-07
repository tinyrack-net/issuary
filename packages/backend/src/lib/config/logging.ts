import z from 'zod';

/**
 * Log level schema.
 * Maps to pino log levels.
 */
export const LogLevelSchema = z.enum([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Log format schema.
 * - 'json': Structured JSON output (default)
 * - 'pretty': Human-readable pretty-printed output
 */
export const LogFormatSchema = z.enum(['json', 'pretty']);

export type LogFormat = z.infer<typeof LogFormatSchema>;

/**
 * Logging configuration schema.
 *
 * Controls the log level and output format.
 * Configured via config file only (no environment variable override).
 */
export const LoggingConfigSchema = z
  .object({
    level: LogLevelSchema.default('info').describe('Log level.'),
    format: LogFormatSchema.default('json').describe(
      'Log output format. ' +
        '"json" outputs structured JSON (default). ' +
        '"pretty" outputs human-readable format.',
    ),
    http_log_proxy: z
      .boolean()
      .default(false)
      .describe(
        'Whether to log HTTP access logs for proxied frontend requests ' +
          'in development mode. When false (default), proxy requests ' +
          'are completely suppressed, keeping the terminal clean. ' +
          'Set to true to see them.',
      ),
  })
  .default({
    level: 'info',
    format: 'json',
    http_log_proxy: false,
  })
  .describe('Logging configuration');

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
