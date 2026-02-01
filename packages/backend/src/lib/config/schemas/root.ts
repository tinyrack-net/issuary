import z from 'zod/v4';
import { AppConfigAdmin, AppConfigApp } from './app.js';
import { AppConfigAuth } from './auth.js';
import { AppConfigCleanup, DEFAULT_CLEANUP_CONFIG } from './cleanup.js';
import { AppConfigClient } from './client.js';
import { AppConfigDatabase } from './database.js';
import { AppConfigIdentityProviders } from './identity-providers.js';
import { AppConfigScheduler, DEFAULT_SCHEDULER_CONFIG } from './scheduler.js';
import { AppConfigSmtp } from './smtp.js';
import { AppConfigTerms } from './terms.js';
import { AppConfigUser } from './user.js';

/**
 * Unified application configuration schema.
 *
 * This schema defines the structure for both user input (config.yaml)
 * and parsed configuration. The SMTP field supports a `{ test: true }`
 * shorthand that gets resolved to actual SMTP credentials at runtime.
 */
export const AppConfigSchema = z.object({
  app: AppConfigApp,
  admin: AppConfigAdmin.optional().default({
    enabled: false,
  }),
  database: AppConfigDatabase.optional().default({
    type: 'sqlite',
    path: 'test.db',
  }),
  auth: AppConfigAuth.optional().default({
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
  identity_providers: AppConfigIdentityProviders.optional().default([]),
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
  cleanup: AppConfigCleanup.optional().default(DEFAULT_CLEANUP_CONFIG),
  scheduler: AppConfigScheduler.optional().default(DEFAULT_SCHEDULER_CONFIG),
  terms: AppConfigTerms.optional().default([]),
  clients: z.array(AppConfigClient).optional().default([]),
  users: z.array(AppConfigUser).optional().default([]),
});

/**
 * Input type for AppConfigSchema - use this for function parameters.
 * Fields with defaults are optional in this type.
 */
export type AppConfigInput = z.input<typeof AppConfigSchema>;

/**
 * Output type for AppConfigSchema - use this for parsed config.
 * All fields are present after parsing (defaults applied).
 * Note: smtp field may still be `{ test: true }` - use ResolvedAppConfig
 * for runtime usage where smtp is fully resolved.
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Fully resolved configuration type - use this at runtime.
 * The smtp field is guaranteed to be either a full AppConfigSmtp object
 * or undefined (the `{ test: true }` shorthand has been resolved).
 */
export type ResolvedAppConfig = Omit<AppConfig, 'smtp'> & {
  smtp: AppConfigSmtp | undefined;
};

// Re-export individual schemas for external use
export { AppConfigAdmin, AppConfigApp } from './app.js';
export {
  AppConfigAuth,
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
} from './auth.js';
export { AppConfigCleanup, DEFAULT_CLEANUP_CONFIG } from './cleanup.js';
export { AppConfigClient } from './client.js';
export {
  AppConfigDatabase,
  AppConfigDatabaseMemory,
  AppConfigDatabasePostgres,
  AppConfigDatabaseSqlite,
} from './database.js';
export {
  AppConfigIdentityProvider,
  AppConfigIdentityProviders,
  AppleOAuthSchema,
  GenericOAuthSchema,
  GithubOAuthSchema,
  GoogleOAuthSchema,
} from './identity-providers.js';
export {
  AppConfigScheduler,
  DEFAULT_SCHEDULER_CONFIG,
} from './scheduler.js';
export { AppConfigSmtp } from './smtp.js';
export { AppConfigTerms, type TermsItem } from './terms.js';
export { AppConfigUser } from './user.js';
