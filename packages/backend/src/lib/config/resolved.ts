import z from 'zod';
import { AccountDeletionConfigSchema } from './account-deletion.js';
import { AuthConfigSchema } from './auth.js';
import { BrandingConfigSchema } from './branding.js';
import { CleanupConfigSchema } from './cleanup.js';
import { ClientConfigsSchema } from './client.js';
import { DatabaseConfigSchema } from './database.js';
import { EmailConfigSchema } from './email.js';
import { FrontendConfigSchema } from './frontend.js';
import { I18nConfigSchema } from './i18n.js';
import { IdentityProviderConfigsSchema } from './identity-providers.js';
import { LoggingConfigSchema } from './logging.js';
import { RegistrationConfigSchema } from './registration.js';
import { SchedulerConfigSchema } from './scheduler.js';
import { SecurityConfigSchema } from './security.js';
import { ServerConfigSchema } from './server.js';
import { TermsConfigSchema } from './terms.js';
import { TokensConfigSchema } from './tokens.js';
import { UserConfigsSchema } from './user.js';

export const TinyAuthRuntimeConfigSchema = z
  .object({
    server: ServerConfigSchema,
    tokens: TokensConfigSchema,
    i18n: I18nConfigSchema,
    branding: BrandingConfigSchema,
    registration: RegistrationConfigSchema,
    account_deletion: AccountDeletionConfigSchema,
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
    email: EmailConfigSchema,
    identity_providers: IdentityProviderConfigsSchema,
  })
  .strict();

export type TinyAuthRuntimeConfigInput = z.input<
  typeof TinyAuthRuntimeConfigSchema
>;
export type TinyAuthRuntimeConfig = z.output<
  typeof TinyAuthRuntimeConfigSchema
>;
