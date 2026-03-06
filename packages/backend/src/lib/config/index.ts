// Identity provider
export {
  apple,
  genericOAuth,
  github,
  google,
  type ResolvedIdentityProvider,
} from '#backend/identity-provider.js';
// Duration utilities
export {
  calculateCutoffDate,
  calculatePermanentDeletionDate,
  type DurationString,
  formatDuration,
  parseDurationToMs,
} from '#backend/lib/duration.js';
// Zod error formatting
export {
  ConfigValidationError,
  formatZodError,
} from '#backend/lib/format-zod-error.js';
// Password policy
export { getPasswordPolicyError } from '#backend/lib/password-policy.js';
export type {
  AppConfigClient,
  AppConfigDatabase,
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
  AppConfigSecondFactor,
  AppConfigSmtp,
  AppConfigUser,
  LogFormat,
  LogLevel,
  ResolvedAppConfig,
  TermsItem,
} from './schema.js';
// Config schemas and types
export {
  AppConfigApp,
  AppConfigAuth,
  AppConfigCleanup,
  AppConfigIdentityProvider,
  AppConfigIdentityProviders,
  AppConfigLogging,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
  AppConfigPasswordPolicy,
  AppConfigScheduler,
  AppConfigSecurity,
  AppConfigTerms,
  AppTheme,
  DEFAULT_CLEANUP_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
} from './schema.js';
