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

export const LOGGING_CONFIG_DEFAULT: {
  level: LogLevel;
  format: LogFormat;
} = {
  level: 'info',
  format: 'json',
};

/**
 * Logging configuration schema.
 *
 * Controls the log level and output format.
 * Configured via config file only (no environment variable override).
 */
export const LoggingConfigSchema = z
  .object({
    level: LogLevelSchema.default(LOGGING_CONFIG_DEFAULT.level).describe(
      'Log level.',
    ),
    format: LogFormatSchema.default(LOGGING_CONFIG_DEFAULT.format).describe(
      'Log output format. ' +
        '"json" outputs structured JSON (default). ' +
        '"pretty" outputs human-readable format.',
    ),
  })
  .strict()
  .default(LOGGING_CONFIG_DEFAULT)
  .describe('Logging configuration');

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
