import z from 'zod';
import { AppConfigSchema } from './app.js';
import { AuthConfigSchema } from './auth.js';
import { CleanupConfigSchema } from './cleanup.js';
import { ClientConfigSchema } from './client.js';
import { DatabaseConfigSchema } from './database.js';
import { IdentityProviderConfigSchema } from './identity-providers.js';
import { LoggingConfigSchema } from './logging.js';
import { MailConfigSchema } from './mail.js';
import { SchedulerConfigSchema } from './scheduler.js';
import { SecurityConfigSchema } from './security.js';
import { TermsConfigSchema } from './terms.js';
import { UserConfigSchema } from './user.js';

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
  clients: z.array(ClientConfigSchema),
  users: z.array(UserConfigSchema),
  database: DatabaseConfigSchema,
  mail: MailConfigSchema.optional(),
  identity_providers: z.array(IdentityProviderConfigSchema),
});

export type TinyAuthConfigs = z.infer<typeof TinyAuthConfigsSchema>;
