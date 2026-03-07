import {
  AppConfigSchema,
  AuthConfigSchema,
  CleanupConfigSchema,
  LoggingConfigSchema,
  SchedulerConfigSchema,
  SecurityConfigSchema,
  TermsConfigSchema,
  type TinyAuthConfigs,
} from '@tinyauth/backend/config';
import z from 'zod';

// ---------------------------------------------------------------------------
// Identity Provider Zod schemas (for YAML config validation)
// ---------------------------------------------------------------------------

const GithubOAuthSchema = z.object({
  id: z.string().min(1),
  type: z.literal('github'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const GoogleOAuthSchema = z.object({
  id: z.string().min(1),
  type: z.literal('google'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const AppleOAuthSchema = z.object({
  id: z.string().min(1),
  type: z.literal('apple'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional(),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
});

const GenericOAuthSchema = z.object({
  id: z.string().min(1),
  type: z.literal('generic_oauth'),
  enabled: z.boolean().default(false),
  display_name: z.string().min(1),
  icon_url: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  authorization_url: z.url(),
  token_url: z.url(),
  userinfo_url: z.url().nullish(),
  email_url: z.url().optional(),
  scopes: z.array(z.string()).min(1),
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link'),
  userinfo_mapping: z.object({
    id: z.string(),
    email: z.string(),
    email_verified: z.string().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
  }),
});

const AppConfigIdentityProvider = z.discriminatedUnion('type', [
  GithubOAuthSchema,
  GoogleOAuthSchema,
  AppleOAuthSchema,
  GenericOAuthSchema,
]);

const AppConfigIdentityProviders = z
  .array(AppConfigIdentityProvider)
  .default([]);

// ---------------------------------------------------------------------------
// Local Zod schemas for runtime validation (types live in backend)
// ---------------------------------------------------------------------------

const AppConfigSmtpSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.string().optional(),
  test: z.boolean().default(false),
});

const AppConfigUserSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  password: z.string().min(1).max(256),
  role: z.enum(['user', 'admin']).default('user'),
});

const AppConfigClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logo_uri: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  redirect_uris: z.array(z.string()).min(1),
  response_types: z.array(z.string()).min(1),
  grant_types: z.array(z.string()).min(1),
  scope: z.string().min(1),
});

const AppConfigDatabaseSqliteSchema = z.object({
  type: z.literal('sqlite'),
  path: z.string().default('./test.db'),
  test: z.boolean().default(false),
});

const AppConfigDatabasePostgresSchema = z.object({
  type: z.literal('postgres'),
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(5432),
  user: z.string().min(1).default('test'),
  password: z.string().min(1).default('test'),
  name: z.string().min(1).default('test'),
});

const AppConfigDatabaseSchema = z.discriminatedUnion('type', [
  AppConfigDatabaseSqliteSchema,
  AppConfigDatabasePostgresSchema,
]);

export const StandaloneFrontendConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['proxy', 'static']).default('static'),
  path: z.string().optional(),
});

export type StandaloneFrontendConfigInput = z.input<
  typeof StandaloneFrontendConfigSchema
>;
export type StandaloneFrontendConfig = z.infer<
  typeof StandaloneFrontendConfigSchema
>;

export type ResolvedStandaloneFrontendConfig = {
  enabled: boolean;
  mode: 'proxy' | 'static';
  path: string;
};

const StandaloneAppSchema = AppConfigSchema.extend({
  frontend: StandaloneFrontendConfigSchema.default({
    enabled: true,
    mode: 'static',
  }),
  html_variables: z.record(z.string(), z.string()).default({}),
});

export const StandaloneConfigSchema = z.object({
  app: StandaloneAppSchema,
  database: AppConfigDatabaseSchema.default({
    type: 'sqlite',
    path: './test.db',
    test: false,
  }),
  logging: LoggingConfigSchema,
  auth: AuthConfigSchema,
  identity_providers: AppConfigIdentityProviders.default([]),
  security: SecurityConfigSchema,
  smtp: z
    .discriminatedUnion('test', [
      AppConfigSmtpSchema.extend({
        test: z.literal(false),
      }),
      z.object({
        test: z.literal(true),
      }),
    ])
    .optional(),
  cleanup: CleanupConfigSchema,
  scheduler: SchedulerConfigSchema,
  terms: TermsConfigSchema.default([]),
  clients: z.array(AppConfigClientSchema).default([]),
  users: z.array(AppConfigUserSchema).default([]),
});

export type StandaloneConfigInput = z.input<typeof StandaloneConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;

export type ResolvedStandaloneConfig = Omit<TinyAuthConfigs, 'app'> & {
  app: TinyAuthConfigs['app'] & {
    frontend: ResolvedStandaloneFrontendConfig;
    html_variables: Record<string, string>;
  };
};
