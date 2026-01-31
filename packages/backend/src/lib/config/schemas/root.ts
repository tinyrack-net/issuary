import z from 'zod/v4';
import { AppConfigAccountDeletion } from './account-deletion.js';
import { AppConfigAdmin, AppConfigApp } from './app.js';
import { AppConfigBasicAuthenticationMethods } from './auth-basic.js';
import { AppConfigOAuthAuthenticationMethods } from './auth-oauth.js';
import { AppConfigDatabase } from './database.js';
import { AppConfigProvider } from './provider.js';
import { AppConfigScheduler, DEFAULT_SCHEDULER_CONFIG } from './scheduler.js';
import { AppConfigSmtp } from './smtp.js';
import { AppConfigTerms } from './terms.js';
import { AppConfigUser } from './user.js';

export const ConfigSchema = z.object({
  app: AppConfigApp,
  admin: AppConfigAdmin.default({
    enabled: false,
  }).optional(),
  database: AppConfigDatabase.default({
    type: 'sqlite',
    path: 'test.db',
  }),
  basic_authentication_methods: AppConfigBasicAuthenticationMethods.default({
    password: {
      enabled: true,
      email_verification: true,
      second_factor: {
        required: false,
      },
      totp: {
        enabled: false,
      },
    },
    passkey: {
      enabled: false,
      email_verification: true,
    },
  }),
  oauth_authentication_methods: AppConfigOAuthAuthenticationMethods.default([]),
  smtp: z
    .discriminatedUnion('test', [
      AppConfigSmtp.extend({
        test: z.literal(false),
      }),
      z.object({
        test: z.literal(true),
      }),
    ])
    .optional(),
  account_deletion: AppConfigAccountDeletion.default({
    enabled: false,
    retention_period: '30d',
  }),
  scheduler: AppConfigScheduler.default(DEFAULT_SCHEDULER_CONFIG),
  terms: AppConfigTerms.default([]),
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

export const InternalConfigSchema = z.object({
  app: AppConfigApp,
  admin: AppConfigAdmin.default({
    enabled: false,
  }).optional(),
  database: AppConfigDatabase.default({
    type: 'sqlite',
    path: 'test.db',
  }),
  basic_authentication_methods: AppConfigBasicAuthenticationMethods.default({
    password: {
      enabled: true,
      email_verification: true,
      second_factor: {
        required: false,
      },
      totp: {
        enabled: false,
        issuer: 'Tinyrack',
      },
    },
    passkey: {
      enabled: false,
      email_verification: true,
    },
  }),
  oauth_authentication_methods: AppConfigOAuthAuthenticationMethods.default([]),
  smtp: AppConfigSmtp.optional(),
  account_deletion: AppConfigAccountDeletion.default({
    enabled: true,
    retention_period: '30d',
  }),
  scheduler: AppConfigScheduler.default(DEFAULT_SCHEDULER_CONFIG),
  terms: AppConfigTerms.default([]),
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

export type InternalAppConfig = z.infer<typeof InternalConfigSchema>;

export {
  AppConfigAccountDeletion,
  calculatePermanentDeletionDate,
  parseDurationToMs,
} from './account-deletion.js';
// Re-export individual schemas for external use
export { AppConfigAdmin, AppConfigApp } from './app.js';
export {
  AppConfigBasicAuthenticationMethods,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
} from './auth-basic.js';
export {
  AppConfigAuthMethodOAuth,
  AppConfigOAuthAuthenticationMethods,
  AppleOAuthSchema,
  GenericOAuthSchema,
  GithubOAuthSchema,
  GoogleOAuthSchema,
} from './auth-oauth.js';
export {
  AppConfigDatabase,
  AppConfigDatabaseMemory,
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
} from './database.js';
export { AppConfigProvider } from './provider.js';
export {
  AppConfigScheduler,
  DEFAULT_SCHEDULER_CONFIG,
  SchedulerJobConfig,
} from './scheduler.js';
export { AppConfigSmtp } from './smtp.js';
export { AppConfigTerms, type TermsItem } from './terms.js';
export { AppConfigUser } from './user.js';
