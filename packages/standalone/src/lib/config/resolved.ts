import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import z from 'zod';
import { StandaloneAppConfigSchema } from './app.js';
import { StandaloneAuthConfigSchema } from './auth.js';
import { StandaloneCleanupConfigSchema } from './cleanup.js';
import { StandaloneClientConfigsSchema } from './client.js';
import { StandaloneDatabaseConfigSchema } from './database.js';
import type { ResolvedStandaloneFrontendConfig } from './frontend.js';
import { StandaloneIdentityProviderConfigsSchema } from './identity-providers.js';
import { StandaloneLoggingConfigSchema } from './logging.js';
import { StandaloneSchedulerConfigSchema } from './scheduler.js';
import { StandaloneSecurityConfigSchema } from './security.js';
import { StandaloneSmtpUnionSchema } from './smtp.js';
import { StandaloneTermsConfigSchema } from './terms.js';
import { StandaloneUserConfigsSchema } from './user.js';

export const StandaloneConfigSchema = z.object({
  app: StandaloneAppConfigSchema,
  database: StandaloneDatabaseConfigSchema,
  logging: StandaloneLoggingConfigSchema,
  auth: StandaloneAuthConfigSchema,
  identity_providers: StandaloneIdentityProviderConfigsSchema.default([]),
  security: StandaloneSecurityConfigSchema,
  smtp: StandaloneSmtpUnionSchema,
  cleanup: StandaloneCleanupConfigSchema,
  scheduler: StandaloneSchedulerConfigSchema,
  terms: StandaloneTermsConfigSchema.default([]),
  clients: StandaloneClientConfigsSchema,
  users: StandaloneUserConfigsSchema,
});

export type StandaloneConfigInput = z.input<typeof StandaloneConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;

export type ResolvedStandaloneConfig = Omit<TinyAuthConfigs, 'app'> & {
  app: TinyAuthConfigs['app'] & {
    frontend: ResolvedStandaloneFrontendConfig;
    html_variables: Record<string, string>;
  };
};

