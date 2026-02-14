// Duration utilities
export {
  calculateCutoffDate,
  calculatePermanentDeletionDate,
  type DurationString,
  formatDuration,
  parseDurationToMs,
} from '@backend/lib/duration.js';
// Config loader
export { loadConfig, resolveConfig } from './loader.js';
// OAuth resolver
export {
  type ResolvedOAuthConfig,
  resolveOAuthConfig,
  WELL_KNOWN_OAUTH_PROVIDERS,
  type WellKnownOAuthProvider,
} from './oauth-resolver.js';
// Config schemas and types
export {
  type AppConfig,
  AppConfigApp,
  type AppConfigInput,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
  AppConfigSchema,
  AppConfigSmtp,
  AppConfigTerms,
  AppTheme,
  type ResolvedAppConfig,
} from './schema.js';
