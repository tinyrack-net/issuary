import z from 'zod';
import { AccountDeletionConfigSchema } from './account-deletion.ts';
import { AdminConfigSchema } from './admin.ts';
import { AuthConfigSchema } from './auth.ts';
import { BrandingConfigSchema } from './branding.ts';
import { CleanupConfigSchema } from './cleanup.ts';
import { ClientConfigsSchema } from './client.ts';
import { DatabaseConfigSchema } from './database.ts';
import { EmailConfigSchema } from './email.ts';
import { FrontendConfigSchema } from './frontend.ts';
import { I18nConfigSchema } from './i18n.ts';
import { IdentityProviderConfigsSchema } from './identity-providers.ts';
import { LoggingConfigSchema } from './logging.ts';
import { OpenApiConfigSchema } from './openapi.ts';
import { RegistrationConfigSchema } from './registration.ts';
import { SchedulerConfigSchema } from './scheduler.ts';
import { SecurityConfigSchema } from './security.ts';
import { ServerConfigSchema } from './server.ts';
import { TermsConfigSchema } from './terms.ts';
import { TokensConfigSchema } from './tokens.ts';
import { UserConfigsSchema } from './user.ts';

export const TinyAuthRuntimeConfigSchema = z
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
    admin: AdminConfigSchema.describe('Admin console settings.'),
    logging: LoggingConfigSchema.describe('Logging settings.'),
    openapi: OpenApiConfigSchema.describe(
      'OpenAPI and API reference settings.',
    ),
    auth: AuthConfigSchema.describe('Authentication methods settings.'),
    security: SecurityConfigSchema.describe(
      'Security and cryptographic settings.',
    ),
    cleanup: CleanupConfigSchema.describe('Data cleanup settings.'),
    scheduler: SchedulerConfigSchema.describe('Cleanup scheduler adapter.'),
    terms: TermsConfigSchema.describe('Terms of service settings.'),
    clients: ClientConfigsSchema.describe(
      'Registered OAuth/OIDC client applications.',
    ),
    users: UserConfigsSchema.describe('Pre-provisioned user accounts.'),
    database: DatabaseConfigSchema.describe('Database adapter settings.'),
    frontend: FrontendConfigSchema.describe(
      'Frontend handler for serving the UI.',
    ),
    email: EmailConfigSchema.describe('Email transport adapter settings.'),
    identity_providers: IdentityProviderConfigsSchema.describe(
      'External identity provider settings.',
    ),
  })
  .strict()
  .describe('TinyAuth runtime configuration.');

export type TinyAuthRuntimeConfigInput = z.input<
  typeof TinyAuthRuntimeConfigSchema
>;
export type TinyAuthRuntimeConfig = z.output<
  typeof TinyAuthRuntimeConfigSchema
>;
