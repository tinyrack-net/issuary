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
// Account deletion config schema
export { AppConfigAccountDeletion } from './schemas/account-deletion.js';
// App config schemas
export {
  AppConfigAdmin,
  AppConfigApp,
  AppTheme,
} from './schemas/app.js';
// Basic authentication schemas
export {
  AppConfigBasicAuthenticationMethods,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
  AppConfigSecondFactor,
} from './schemas/auth-basic.js';
// OAuth authentication schemas
export {
  AppConfigAuthMethodOAuth,
  AppConfigOAuthAuthenticationMethods,
  AppleOAuthSchema,
  GenericOAuthSchema,
  GithubOAuthSchema,
  GoogleOAuthSchema,
} from './schemas/auth-oauth.js';
// Cleanup config schema
export { AppConfigCleanup, DEFAULT_CLEANUP_CONFIG } from './schemas/cleanup.js';
// Database config schemas
export {
  AppConfigDatabase,
  AppConfigDatabaseMemory,
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
} from './schemas/database.js';
// Provider config schema
export { AppConfigProvider } from './schemas/provider.js';
// Root config schemas and types
export {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  AppConfigSchema as ConfigSchema,
  type ResolvedAppConfig,
} from './schemas/root.js';
// SMTP config schema
export { AppConfigSmtp } from './schemas/smtp.js';
// User config schema
export { AppConfigUser } from './schemas/user.js';
