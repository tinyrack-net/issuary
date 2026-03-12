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
    server: ServerConfigSchema.describe('HTTP server settings.'),
    tokens: TokensConfigSchema.describe(
      'Token issuance and signing key settings.',
    ),
    i18n: I18nConfigSchema.describe('Internationalization settings.'),
    branding: BrandingConfigSchema.describe(
      'Branding and visual customization settings.',
    ),
    registration: RegistrationConfigSchema.describe(
      'User self-registration settings.',
    ),
    account_deletion: AccountDeletionConfigSchema.describe(
      'Account deletion settings.',
    ),
    logging: LoggingConfigSchema.describe('Logging settings.'),
    auth: AuthConfigSchema.describe('Authentication methods settings.'),
    security: SecurityConfigSchema.describe(
      'Security and cryptographic settings.',
    ),
    cleanup: CleanupConfigSchema.describe('Data cleanup settings.'),
    scheduler: SchedulerConfigSchema.describe(
      'In-process cleanup scheduler settings.',
    ),
    terms: TermsConfigSchema.describe('Terms of service settings.'),
    clients: ClientConfigsSchema.describe(
      'Registered OAuth/OIDC client applications.',
    ),
    users: UserConfigsSchema.describe('Pre-provisioned user accounts.'),
    database: DeclarativeDatabaseConfigSchema.describe('Database settings.'),
    email: DeclarativeEmailConfigSchema.describe('Email transport settings.'),
    identity_providers: DeclarativeIdentityProviderConfigsSchema.describe(
      'External identity provider settings.',
    ),
  })
  .strict()
  .describe('TinyAuth declarative configuration.');

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
