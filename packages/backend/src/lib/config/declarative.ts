import z from 'zod';
import { AccountDeletionConfigSchema } from './account-deletion.js';
import { AuthConfigSchema } from './auth.js';
import {
  type DeclarativeDatabaseConfig,
  DeclarativeDatabaseConfigSchema,
} from './authoring-database.js';
import {
  type DeclarativeEmailConfig,
  DeclarativeEmailConfigSchema,
} from './authoring-email.js';
import {
  type DeclarativeIdentityProviderConfig,
  DeclarativeIdentityProviderConfigsSchema,
} from './authoring-identity-providers.js';
import { BrandingConfigSchema } from './branding.js';
import { CleanupConfigSchema } from './cleanup.js';
import { ClientConfigsSchema } from './client.js';
import { I18nConfigSchema } from './i18n.js';
import { LoggingConfigSchema } from './logging.js';
import { RegistrationConfigSchema } from './registration.js';
import { SchedulerConfigSchema } from './scheduler.js';
import { SecurityConfigSchema } from './security.js';
import { ServerConfigSchema } from './server.js';
import { TermsConfigSchema } from './terms.js';
import { TokensConfigSchema } from './tokens.js';
import { UserConfigsSchema } from './user.js';

export const TinyAuthDeclarativeConfigSchema = z
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
    database: DeclarativeDatabaseConfigSchema,
    email: DeclarativeEmailConfigSchema,
    identity_providers: DeclarativeIdentityProviderConfigsSchema,
  })
  .strict();

export type TinyAuthDeclarativeConfigInput = z.input<
  typeof TinyAuthDeclarativeConfigSchema
>;
export type TinyAuthDeclarativeConfig = z.infer<
  typeof TinyAuthDeclarativeConfigSchema
>;

export type TinyAuthDeclarativeDatabaseConfig = DeclarativeDatabaseConfig;
export type TinyAuthDeclarativeEmailConfig = DeclarativeEmailConfig;
export type TinyAuthDeclarativeIdentityProviderConfig =
  DeclarativeIdentityProviderConfig;
