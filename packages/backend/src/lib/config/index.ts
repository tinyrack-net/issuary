// Config loader

// Duration utilities
export {
  calculateCutoffDate,
  calculatePermanentDeletionDate,
  DurationString,
  formatDuration,
  parseDurationToMs,
} from './duration.js';
export {
  type DeepPartial,
  deepMerge,
  loadConfig,
  resolveConfig,
} from './loader.js';
// OAuth resolver
export {
  type ResolvedOAuthConfig,
  resolveOAuthConfig,
  WELL_KNOWN_OAUTH_PROVIDERS,
  type WellKnownOAuthProvider,
} from './oauth-resolver.js';
// App config schemas
export {
  AppConfigAdmin,
  AppConfigApp,
  AppTheme,
} from './schemas/app.js';
// Authentication schemas
export {
  AppConfigAuth,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
  AppConfigSecondFactor,
} from './schemas/auth.js';
// Cleanup config schema
export { AppConfigCleanup, DEFAULT_CLEANUP_CONFIG } from './schemas/cleanup.js';
// Client config schema
export { AppConfigClient } from './schemas/client.js';
// Database config schemas
export {
  AppConfigDatabase,
  AppConfigDatabaseMemory,
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
} from './schemas/database.js';
// Identity provider schemas
export {
  AppConfigIdentityProvider,
  AppConfigIdentityProviders,
  AppleOAuthSchema,
  GenericOAuthSchema,
  GithubOAuthSchema,
  GoogleOAuthSchema,
} from './schemas/identity-providers.js';
// Root config schemas and types
export {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  AppConfigSchema as ConfigSchema,
  type ResolvedAppConfig,
} from './schemas/root.js';
// Scheduler config schema
export {
  AppConfigScheduler,
  DEFAULT_SCHEDULER_CONFIG,
} from './schemas/scheduler.js';
// SMTP config schema
export { AppConfigSmtp } from './schemas/smtp.js';
// Terms config schema
export { AppConfigTerms, type TermsItem } from './schemas/terms.js';
// User config schema
export { AppConfigUser } from './schemas/user.js';
