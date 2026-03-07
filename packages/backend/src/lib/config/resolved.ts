import type { AppConfigApp } from './app.js';
import type { AppConfigAuth } from './auth.js';
import type { AppConfigCleanup } from './cleanup.js';
import type { AppConfigClient } from './client.js';
import type { DatabaseConfigRuntime } from './database.js';
import type { ResolvedIdentityProvider } from './identity-providers.js';
import type { AppConfigLogging } from './logging.js';
import type { MailConfigRuntime } from './mail.js';
import type { AppConfigScheduler } from './scheduler.js';
import type { AppConfigSecurity } from './security.js';
import type { AppConfigTerms } from './terms.js';
import type { AppConfigUser } from './user.js';

/**
 * Fully resolved configuration type - use this at runtime.
 * All fields are guaranteed to be fully resolved:
 * - database: composed with MikroORM options
 * - smtp: fully resolved (no `{ test: true }` shorthand)
 * - identity_providers: resolved with endpoint URLs
 */
export interface ResolvedAppConfig {
  app: AppConfigApp;
  logging: AppConfigLogging;
  auth: AppConfigAuth;
  security: AppConfigSecurity;
  cleanup: AppConfigCleanup;
  scheduler: AppConfigScheduler;
  terms: AppConfigTerms;
  clients: AppConfigClient[];
  users: AppConfigUser[];
  database: DatabaseConfigRuntime;
  mail?: MailConfigRuntime;
  identity_providers: ResolvedIdentityProvider[];
}
