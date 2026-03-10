import z from 'zod';
import { AppConfigSchema } from './app.js';
import { AuthConfigSchema } from './auth.js';
import { CleanupConfigSchema } from './cleanup.js';
import { ClientConfigsSchema } from './client.js';
import { DatabaseConfigSchema } from './database.js';
import { FrontendConfigSchema } from './frontend.js';
import { IdentityProviderConfigsSchema } from './identity-providers.js';
import { LoggingConfigSchema } from './logging.js';
import { MailConfigSchema } from './mail.js';
import { SchedulerConfigSchema } from './scheduler.js';
import { SecurityConfigSchema } from './security.js';
import { TermsConfigSchema } from './terms.js';
import { UserConfigsSchema } from './user.js';

/**
 * Fully resolved configuration type - use this at runtime.
 * All fields are guaranteed to be fully resolved:
 * - database: composed with MikroORM options
 * - smtp: fully resolved (no `{ test: true }` shorthand)
 * - identity_providers: resolved with endpoint URLs
 */
export const TinyAuthConfigsSchema = z.object({
  app: AppConfigSchema,
  logging: LoggingConfigSchema,
  auth: AuthConfigSchema,
  security: SecurityConfigSchema,
  cleanup: CleanupConfigSchema,
  scheduler: SchedulerConfigSchema,
  terms: TermsConfigSchema,
  clients: ClientConfigsSchema,
  users: UserConfigsSchema,
  database: DatabaseConfigSchema,
  frontend: FrontendConfigSchema,
  mail: MailConfigSchema,
  identity_providers: IdentityProviderConfigsSchema,
});

export type TinyAuthInputConfigs = z.input<typeof TinyAuthConfigsSchema>;
export type TinyAuthConfigs = z.infer<typeof TinyAuthConfigsSchema>;
