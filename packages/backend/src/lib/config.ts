import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import YAML from 'yaml';
import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';
import { env } from './env.js';

export const AppTheme = z.enum([
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
  'caramellatte',
  'abyss',
  'silk',
]);

export const AppConfigApp = z.object({
  host: z.string().optional().default('http://localhost:3000'),
  port: zz.PORT.optional().default(8080),
  cookie_secret: z.string().min(16),
  jwt_access_token_ttl: z.number().int().min(60).optional().default(3600), // 1 hour
  jwt_refresh_token_ttl: z.number().int().min(3600).optional().default(2592000), // 30 days
  // JWT Key Rotation Settings (RS256)
  jwt_key_rotation_enabled: z
    .boolean()
    .optional()
    .default(true)
    .describe('Enable automatic JWT key rotation'),
  jwt_key_rotation_days: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(30)
    .describe('Days between key rotations'),
  jwt_key_overlap_days: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(7)
    .describe('Days to keep previous keys valid after rotation'),
  public_registration: z
    .boolean()
    .default(true)
    .describe('Allow public user registration'),
  supported_languages: z
    .array(z.string())
    .default(['en'])
    .describe('Supported languages'),
  default_language: z.string().default('auto').describe('Default language'),
  fallback_language: z.string().default('en').describe('Fallback language'),

  light_theme: AppTheme.default('light').describe('Light theme name'),
  dark_theme: AppTheme.default('dark').describe('Dark theme name'),
  theme_mode: z
    .enum(['light', 'dark', 'system'])
    .default('system')
    .describe('Default theme mode'),
  background_url: z
    .string()
    .url()
    .optional()
    .describe('Background image URL for authentication pages'),
});

export type AppConfigApp = z.infer<typeof AppConfigApp>;

export const AppConfigAdmin = z.discriminatedUnion('enabled', [
  z.object({
    enabled: z.literal(false),
  }),
  z.object({
    enabled: z.literal(true),
    port: zz.PORT.optional().default(8081),
  }),
]);

export type AppConfigAdmin = z.infer<typeof AppConfigAdmin>;

export const AppConfigDatabaseMemory = z.object({
  type: z.literal('memory'),
});

export type AppConfigDatabaseMemory = z.infer<typeof AppConfigDatabaseMemory>;

export const AppConfigDatabaseSqlite = z.object({
  type: z.literal('sqlite'),
  path: z.string().default('test.db'),
});

export type AppConfigDatabaseSqlite = z.infer<typeof AppConfigDatabaseSqlite>;

export const AppConfigDatabasePostgres = z.object({
  type: z.literal('postgres'),
  host: z.string().default('localhost'),
  port: zz.PORT.default(5432),
  user: z.string().min(1).default('test'),
  password: z.string().min(1).default('test'),
  name: z.string().min(1).default('test'),
});

export type AppConfigDatabasePostgres = z.infer<
  typeof AppConfigDatabasePostgres
>;

export const AppConfigDatabase = z.discriminatedUnion('type', [
  AppConfigDatabaseMemory,
  AppConfigDatabaseSqlite,
  AppConfigDatabasePostgres,
]);

export type AppConfigDatabase = z.infer<typeof AppConfigDatabase>;

/**
 * Well-known OAuth providers with pre-configured endpoints.
 * Users only need to provide client_id and client_secret for these.
 */
export const WELL_KNOWN_OAUTH_PROVIDERS = {
  google: {
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
    default_scopes: ['openid', 'email', 'profile'],
    // Google returns: sub, email, email_verified, name, picture, given_name, family_name
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
      name: 'name',
      picture: 'picture',
    },
  },
  github: {
    authorization_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    userinfo_url: 'https://api.github.com/user',
    email_url: 'https://api.github.com/user/emails', // GitHub requires separate call for emails
    default_scopes: ['user:email'],
    // GitHub returns: id, login, name, email, avatar_url
    userinfo_mapping: {
      id: 'id',
      email: 'email',
      name: 'name',
      picture: 'avatar_url',
    },
  },
  apple: {
    authorization_url: 'https://appleid.apple.com/auth/authorize',
    token_url: 'https://appleid.apple.com/auth/token',
    // Apple uses ID token, not userinfo endpoint
    userinfo_url: null,
    default_scopes: ['openid', 'email', 'name'],
    response_mode: 'form_post',
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
    },
  },
} as const;

export type WellKnownOAuthProvider = keyof typeof WELL_KNOWN_OAUTH_PROVIDERS;

/**
 * Password authentication configuration (fixed type).
 */
export const AppConfigPasswordAuth = z.object({
  enabled: z.boolean().default(true),
  email_verification: z.boolean().default(true),
  totp: z
    .object({
      enabled: z.boolean().default(false),
      required: z.boolean().default(false),
    })
    .optional(),
});

export type AppConfigPasswordAuth = z.infer<typeof AppConfigPasswordAuth>;

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const AppConfigPasskeyAuth = z.object({
  enabled: z.boolean().default(false),
  email_verification: z.boolean().default(true),
});

export type AppConfigPasskeyAuth = z.infer<typeof AppConfigPasskeyAuth>;

/**
 * Basic authentication methods configuration (fixed structure).
 * Contains password and passkey authentication settings.
 */
export const AppConfigBasicAuthenticationMethods = z.object({
  password: AppConfigPasswordAuth.default({
    enabled: true,
    email_verification: true,
  }),
  passkey: AppConfigPasskeyAuth.default({
    enabled: false,
    email_verification: true,
  }),
});

export type AppConfigBasicAuthenticationMethods = z.infer<
  typeof AppConfigBasicAuthenticationMethods
>;

/**
 * GitHub OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 */
export const GithubOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('github'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type GithubOAuthSchema = z.infer<typeof GithubOAuthSchema>;

/**
 * Google OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 */
export const GoogleOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('google'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type GoogleOAuthSchema = z.infer<typeof GoogleOAuthSchema>;

/**
 * Apple OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 * Apple uses form_post response mode by default.
 */
export const AppleOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('apple'),
  enabled: z.boolean().default(false),
  display_name: z.string().optional().describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  scopes: z
    .array(z.string())
    .optional()
    .describe('OAuth scopes (defaults to provider defaults)'),
  response_mode: z
    .enum(['query', 'fragment', 'form_post'])
    .optional()
    .describe('Response mode (defaults to form_post for Apple)'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
});

export type AppleOAuthSchema = z.infer<typeof AppleOAuthSchema>;

/**
 * Generic OAuth provider schema for custom OAuth providers.
 * Requires all endpoint URLs and userinfo mapping to be specified.
 */
export const GenericOAuthSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this OAuth provider'),
  type: z.literal('generic_oauth'),
  enabled: z.boolean().default(false),
  display_name: z.string().min(1).describe('Display name shown in UI'),
  icon_url: z.string().optional().describe('Icon URL shown in UI'),
  client_id: z.string().min(1).describe('OAuth client ID'),
  client_secret: z.string().min(1).describe('OAuth client secret'),
  authorization_url: z.url().describe('Authorization endpoint URL'),
  token_url: z.url().describe('Token endpoint URL'),
  userinfo_url: z.url().nullish().describe('UserInfo endpoint URL'),
  email_url: z
    .url()
    .optional()
    .describe('Additional URL for fetching email (e.g., GitHub)'),
  scopes: z.array(z.string()).min(1).describe('OAuth scopes to request'),
  response_mode: z
    .enum(['query', 'fragment', 'form_post'])
    .optional()
    .describe('Response mode'),
  email_conflict_strategy: z
    .enum(['auto_link', 'require_link'])
    .default('auto_link')
    .describe('Email conflict resolution strategy'),
  userinfo_mapping: z
    .object({
      id: z.string().describe('Field name for user ID'),
      email: z.string().describe('Field name for email'),
      email_verified: z
        .string()
        .optional()
        .describe('Field name for email_verified'),
      name: z.string().optional().describe('Field name for name'),
      picture: z.string().optional().describe('Field name for picture'),
    })
    .describe('Mapping from provider userinfo response to standard fields'),
});

export type GenericOAuthSchema = z.infer<typeof GenericOAuthSchema>;

/**
 * OAuth authentication method configuration.
 * Discriminated union based on 'type' field.
 * Well-known providers (github, google, apple) use pre-configured endpoints.
 * Generic OAuth requires all endpoints to be specified.
 */
export const AppConfigAuthMethodOAuth = z.discriminatedUnion('type', [
  GithubOAuthSchema,
  GoogleOAuthSchema,
  AppleOAuthSchema,
  GenericOAuthSchema,
]);

export type AppConfigAuthMethodOAuth = z.infer<typeof AppConfigAuthMethodOAuth>;

/**
 * OAuth authentication methods configuration.
 * Array of OAuth provider configurations.
 */
export const AppConfigOAuthAuthenticationMethods = z
  .array(AppConfigAuthMethodOAuth)
  .default([]);

export type AppConfigOAuthAuthenticationMethods = z.infer<
  typeof AppConfigOAuthAuthenticationMethods
>;

/**
 * Helper function to get resolved OAuth config with well-known provider defaults.
 * Resolves well-known provider endpoints and merges with user config.
 */
export function resolveOAuthConfig(
  config: AppConfigAuthMethodOAuth,
): ResolvedOAuthConfig {
  // Get well-known provider config if applicable
  const wellKnown =
    config.type !== 'generic_oauth'
      ? WELL_KNOWN_OAUTH_PROVIDERS[config.type]
      : null;

  // For generic_oauth, use provided values; for well-known providers, merge with defaults
  if (config.type === 'generic_oauth') {
    const result: ResolvedOAuthConfig = {
      id: config.id,
      type: config.type,
      display_name: config.display_name,
      client_id: config.client_id,
      client_secret: config.client_secret,
      authorization_url: config.authorization_url,
      token_url: config.token_url,
      userinfo_url: config.userinfo_url ?? null,
      scopes: config.scopes,
      email_conflict_strategy: config.email_conflict_strategy,
      userinfo_mapping: {
        id: config.userinfo_mapping.id,
        email: config.userinfo_mapping.email,
      },
    };

    if (config.icon_url) result.icon_url = config.icon_url;
    if (config.email_url) result.email_url = config.email_url;
    if (config.response_mode) result.response_mode = config.response_mode;
    if (config.userinfo_mapping.email_verified) {
      result.userinfo_mapping.email_verified =
        config.userinfo_mapping.email_verified;
    }
    if (config.userinfo_mapping.name) {
      result.userinfo_mapping.name = config.userinfo_mapping.name;
    }
    if (config.userinfo_mapping.picture) {
      result.userinfo_mapping.picture = config.userinfo_mapping.picture;
    }

    return result;
  }

  // Well-known provider (github, google, apple)
  const scopes = config.scopes || [...(wellKnown?.default_scopes ?? [])];
  const emailUrl = (wellKnown as { email_url?: string })?.email_url;
  const responseMode =
    config.type === 'apple'
      ? config.response_mode ||
        (wellKnown as { response_mode?: string })?.response_mode
      : undefined;

  const result: ResolvedOAuthConfig = {
    id: config.id,
    type: config.type,
    display_name: config.display_name || config.id,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: wellKnown?.authorization_url || '',
    token_url: wellKnown?.token_url || '',
    userinfo_url: wellKnown?.userinfo_url ?? null,
    scopes,
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: {
      id: wellKnown?.userinfo_mapping?.id || 'sub',
      email: wellKnown?.userinfo_mapping?.email || 'email',
    },
  };

  if (config.icon_url) result.icon_url = config.icon_url;
  if (emailUrl) result.email_url = emailUrl;
  if (responseMode) result.response_mode = responseMode;

  const emailVerified = (
    wellKnown?.userinfo_mapping as { email_verified?: string } | undefined
  )?.email_verified;
  const userName = (
    wellKnown?.userinfo_mapping as { name?: string } | undefined
  )?.name;
  const userPicture = (
    wellKnown?.userinfo_mapping as { picture?: string } | undefined
  )?.picture;

  if (emailVerified) result.userinfo_mapping.email_verified = emailVerified;
  if (userName) result.userinfo_mapping.name = userName;
  if (userPicture) result.userinfo_mapping.picture = userPicture;

  return result;
}

export interface ResolvedOAuthConfig {
  id: string;
  type: 'github' | 'google' | 'apple' | 'generic_oauth';
  display_name: string;
  icon_url?: string;
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  userinfo_url: string | null;
  email_url?: string;
  scopes: string[];
  response_mode?: string;
  email_conflict_strategy: 'auto_link' | 'require_link';
  userinfo_mapping: {
    id: string;
    email: string;
    email_verified?: string;
    name?: string;
    picture?: string;
  };
}

export const AppConfigSmtp = z.object({
  host: z.string().default('localhost'),
  port: zz.PORT.default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.email(),
  test: z.boolean().default(false),
});

export type AppConfigSmtp = z.infer<typeof AppConfigSmtp>;

export const AppConfigProvider = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logo_uri: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  redirect_uris: z.array(z.string()).min(1),
  response_types: z.array(z.string()).min(1),
  grant_types: z.array(z.string()).min(1),
  scope: z.string().min(1),
});

export type AppConfigProvider = z.infer<typeof AppConfigProvider>;

export const AppConfigUser = z.object({
  id: z.string().min(1),
  email: z.email(),
  password: z.string().min(6).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

export type AppConfigUser = z.infer<typeof AppConfigUser>;

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
    },
    passkey: {
      enabled: false,
      email_verification: true,
    },
  }),
  oauth_authentication_methods: AppConfigOAuthAuthenticationMethods.default([]),
  smtp: AppConfigSmtp.optional(),
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

export type AppConfig = z.infer<typeof InternalConfigSchema>;

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';

const resolveConfigPath = () => {
  const configPath =
    env.APP_ENV === 'test'
      ? './config.test.yaml'
      : env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
  if (path.isAbsolute(configPath)) {
    return configPath;
  } else {
    return path.resolve(process.cwd(), configPath);
  }
};

const loadConfigFromPath = async (configPath: string) => {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found at "${configPath}"`);
  }
  const file = readFileSync(configPath, 'utf8');
  const rawConfig = YAML.parse(file, {
    customTags: [
      {
        tag: '!env',
        resolve: (str: string) => process.env[str],
      },
    ],
  });
  const parsed = ConfigSchema.parse(rawConfig);

  const smtpConfig = await (async () => {
    if (!parsed.smtp) {
      return undefined;
    }
    if (parsed.smtp.test) {
      const testAccount = await nodemailer.createTestAccount();
      return {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        user: testAccount.user,
        password: testAccount.pass,
        from: testAccount.user,
        test: true,
      };
    } else {
      return parsed.smtp;
    }
  })();

  return InternalConfigSchema.parse({
    ...parsed,
    smtp: smtpConfig,
  });
};

/**
 * Deep merge utility for config objects.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object,
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Load configuration from file with optional overrides.
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path (defaults to resolved path based on APP_ENV)
 * @param options.baseConfig - Base config object to use instead of loading from file (useful for testing)
 * @param options.overrides - Partial config to override loaded values (useful for testing)
 */
export async function loadConfig(options?: {
  configPath?: string;
  baseConfig?: AppConfig;
  overrides?: DeepPartial<AppConfig>;
}): Promise<AppConfig> {
  let config: AppConfig;

  if (options?.baseConfig) {
    // Use provided base config instead of loading from file
    console.info('Using provided base config');
    config = options.baseConfig;
  } else {
    const configPath = options?.configPath ?? resolveConfigPath();
    console.info(`Loading config from: ${configPath}`);
    config = await loadConfigFromPath(configPath);
  }

  if (options?.overrides) {
    return deepMerge(config, options.overrides as Partial<AppConfig>);
  }

  return config;
}

/**
 * DeepPartial type for nested partial objects.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
