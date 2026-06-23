import {
  AccountDeletionConfigSchema,
  ADMIN_CONFIG_DEFAULT,
  AuthConfigSchema,
  BrandingConfigSchema,
  CleanupConfigSchema,
  ClientConfigsSchema,
  I18nConfigSchema,
  LoggingConfigSchema,
  OpenApiConfigSchema,
  RegistrationConfigSchema,
  SecurityConfigSchema,
  ServerConfigSchema,
  TermsConfigSchema,
  TokensConfigSchema,
} from '@tinyrack/tinyauth-server/config';
import z from 'zod';
import { StandaloneAdminConfigSchema } from './admin.ts';
import { StandaloneDatabaseConfigSchema } from './database.ts';
import { StandaloneEmailConfigSchema } from './email.ts';
import {
  STANDALONE_FRONTEND_CONFIG_DEFAULT,
  StandaloneFrontendConfigSchema,
} from './frontend.ts';
import { StandaloneIdentityProviderConfigsSchema } from './identity-providers.ts';
import { StandaloneSchedulerConfigSchema } from './scheduler.ts';
import { StandaloneUserConfigsSchema } from './user.ts';

export const StandaloneConfigSchema = z
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
    admin: StandaloneAdminConfigSchema.default(ADMIN_CONFIG_DEFAULT).describe(
      'Admin console settings.',
    ),
    logging: LoggingConfigSchema.describe('Logging settings.'),
    openapi: OpenApiConfigSchema.describe(
      'OpenAPI and API reference settings.',
    ),
    auth: AuthConfigSchema.describe('Authentication methods settings.'),
    security: SecurityConfigSchema.describe(
      'Security and cryptographic settings.',
    ),
    cleanup: CleanupConfigSchema.describe('Data cleanup settings.'),
    scheduler: StandaloneSchedulerConfigSchema.describe(
      'In-process cleanup scheduler settings.',
    ),
    terms: TermsConfigSchema.describe('Terms of service settings.'),
    clients: ClientConfigsSchema.describe(
      'Registered OAuth/OIDC client applications.',
    ),
    users: StandaloneUserConfigsSchema.describe(
      'Pre-provisioned user accounts.',
    ),
    database: StandaloneDatabaseConfigSchema.describe('Database settings.'),
    email: StandaloneEmailConfigSchema.describe('Email transport settings.'),
    identity_providers: StandaloneIdentityProviderConfigsSchema.describe(
      'External identity provider settings.',
    ),
    frontend: StandaloneFrontendConfigSchema.default({
      ...STANDALONE_FRONTEND_CONFIG_DEFAULT,
      html_variables: {
        ...STANDALONE_FRONTEND_CONFIG_DEFAULT.html_variables,
      },
    }),
  })
  .strict()
  .describe('TinyAuth standalone declarative configuration.');

export type StandaloneConfigInput = z.input<typeof StandaloneConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;
