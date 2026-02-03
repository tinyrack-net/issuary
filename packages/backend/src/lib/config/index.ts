// Config loader

// Duration utilities
export {
  calculateCutoffDate,
  calculatePermanentDeletionDate,
  type DurationString,
  formatDuration,
  parseDurationToMs,
} from './duration.js';
export { loadConfig, resolveConfig } from './loader.js';
// OAuth resolver
export {
  type ResolvedOAuthConfig,
  resolveOAuthConfig,
  WELL_KNOWN_OAUTH_PROVIDERS,
  type WellKnownOAuthProvider,
} from './oauth-resolver.js';
// App config schemas
export {
  AppConfigApp,
  AppTheme,
} from './schemas/app.js';
// Authentication schemas
export {
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
} from './schemas/auth.js';
// Root config schemas and types
export {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  type ResolvedAppConfig,
} from './schemas/root.js';
// SMTP config schema
export { AppConfigSmtp } from './schemas/smtp.js';
// Terms config schema
export { AppConfigTerms } from './schemas/terms.js';
