import type { AppConfig } from './app.js';
import type { AuthConfig } from './auth.js';
import type { CleanupConfig } from './cleanup.js';
import type { ClientConfig } from './client.js';
import type { DatabaseConfig } from './database.js';
import type { IdentityProviderConfig } from './identity-providers.js';
import type { LoggingConfig } from './logging.js';
import type { MailConfig } from './mail.js';
import type { SchedulerConfig } from './scheduler.js';
import type { SecurityConfig } from './security.js';
import type { TermsConfig } from './terms.js';
import type { UserConfig } from './user.js';

/**
 * Fully resolved configuration type - use this at runtime.
 * All fields are guaranteed to be fully resolved:
 * - database: composed with MikroORM options
 * - smtp: fully resolved (no `{ test: true }` shorthand)
 * - identity_providers: resolved with endpoint URLs
 */
export interface TinyAuthConfigs {
  app: AppConfig;
  logging: LoggingConfig;
  auth: AuthConfig;
  security: SecurityConfig;
  cleanup: CleanupConfig;
  scheduler: SchedulerConfig;
  terms: TermsConfig;
  clients: ClientConfig[];
  users: UserConfig[];
  database: DatabaseConfig;
  mail?: MailConfig;
  identity_providers: IdentityProviderConfig[];
}
