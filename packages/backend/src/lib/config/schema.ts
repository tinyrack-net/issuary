import z from 'zod';
import { fromBase64Url } from '#backend/lib/base64url.js';
import { DurationString } from '#backend/lib/duration.js';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from '#backend/lib/locale.js';
import {
  getPasswordPolicyError,
  PASSWORD_POLICY_MAX_LENGTH,
  PASSWORD_POLICY_MIN_LENGTH,
} from '#backend/lib/password-policy.js';
import { f } from '#backend/schemas/field.js';
import { zz } from '#backend/schemas/provider.js';

/**
 * Zod schema for locale validation.
 * Validates that a string is one of the available locales.
 */
const LocaleSchema = z.enum(AVAILABLE_LOCALES);

// ---------------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------------

const AppConfigSmtp = z.object({
  host: z.string().default('localhost'),
  port: zz.PORT.default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.string().optional(),
  test: z.boolean().default(false),
});

export type AppConfigSmtp = z.infer<typeof AppConfigSmtp>;

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

const AppConfigUser = z.object({
  sub: z.string().min(1),
  email: f.userEmail,
  password: z.string().min(1).max(PASSWORD_POLICY_MAX_LENGTH),
  role: z.enum(['user', 'admin']).default('user'),
});

export type AppConfigUser = z.infer<typeof AppConfigUser>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * OAuth/OIDC client configuration.
 * Defines applications that can authenticate through TinyAuth.
 */
const AppConfigClient = z.object({
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

export type AppConfigClient = z.infer<typeof AppConfigClient>;

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const AppConfigDatabaseSqlite = z.object({
  type: z.literal('sqlite'),
  path: z.string().default('./test.db'),
  test: z.boolean().default(false),
});

export type AppConfigDatabaseSqlite = z.infer<typeof AppConfigDatabaseSqlite>;

const AppConfigDatabasePostgres = z.object({
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

const AppConfigDatabase = z.discriminatedUnion('type', [
  AppConfigDatabaseSqlite,
  AppConfigDatabasePostgres,
]);

export type AppConfigDatabase = z.infer<typeof AppConfigDatabase>;

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Cron expression string.
 * Accepts standard 5-field cron format: minute hour day month weekday
 * Supports: numbers, ranges (1-5), lists (1,3,5), steps, wildcards
 * Examples: "0 2 * * *" (daily at 2 AM), "0 0/6 * * *" (every 6 hours)
 *
 * Note: Full validation is done by croner at runtime.
 */
const CronExpression = z
  .string()
  .min(9) // Minimum valid cron: "* * * * *"
  .describe('Cron expression in 5-field format');

/**
 * Default scheduler configuration
 */
const DEFAULT_SCHEDULER_CONFIG = {
  enabled: true,
  cron: '0 2 * * *', // Daily at 2 AM
} as const;

/**
 * In-process scheduler configuration.
 *
 * The scheduler runs cleanup tasks automatically on a cron schedule.
 * This is useful for single Docker container deployments.
 *
 * For Kubernetes deployments, disable the scheduler and use CronJobs
 * to run `tinyauth cleanup` externally.
 */
const AppConfigScheduler = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      DEFAULT_SCHEDULER_CONFIG.enabled,
    ).describe(
      'Enable in-process cleanup scheduler. Disable when using external schedulers (K8s CronJob).',
    ),
    cron: CronExpression.default(DEFAULT_SCHEDULER_CONFIG.cron).describe(
      'Cron schedule for running all cleanup tasks. Default: daily at 2 AM.',
    ),
  })
  .describe('In-process scheduler configuration for automated cleanup tasks');

export type AppConfigScheduler = z.infer<typeof AppConfigScheduler>;

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/**
 * Localized content for a term item.
 * Each language code maps to a title, type, and content.
 * Type determines how the content should be interpreted.
 */
const TermsLocalizedContentLink = z.object({
  title: z.string().min(1).describe('Display title for the term'),
  type: z.literal('link').describe('Content type: link to external document'),
  content: z.url().describe('URL to the full terms document'),
});

const TermsLocalizedContentText = z.object({
  title: z.string().min(1).describe('Display title for the term'),
  type: z.literal('text').describe('Content type: inline text'),
  content: z.string().min(1).describe('Inline text content'),
});

const TermsLocalizedContent = z
  .union([TermsLocalizedContentLink, TermsLocalizedContentText])
  .describe('Localized content for a term');

/**
 * Individual term item configuration.
 */
const TermsItem = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric with - or _')
      .describe('Unique identifier for the term'),
    required: z
      .boolean()
      .default(true)
      .describe('Whether agreement to this term is mandatory'),
    consent_mode: z
      .enum(['explicit', 'implicit'])
      .default('explicit')
      .describe(
        'Consent mode for this term: ' +
          '"explicit" shows checkbox requiring user action, ' +
          '"implicit" means signup implies agreement',
      ),
    version: z
      .string()
      .min(1)
      .describe('Version string for tracking changes (e.g., "1.0.0")'),
    content: z
      .record(z.string(), TermsLocalizedContent)
      .default({})
      .describe(
        'Localized content keyed by language code (e.g., "en", "ko"). ' +
          'Can be omitted for implicit consent terms where content is not displayed.',
      ),
  })
  .describe('Individual term configuration');

export type TermsItem = z.infer<typeof TermsItem>;

/**
 * Terms configuration schema.
 */
const AppConfigTerms = z
  .array(TermsItem)
  .default([])
  .describe('Terms of service configuration');

export type AppConfigTerms = z.infer<typeof AppConfigTerms>;

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Configuration for revoked tokens cleanup
 */
const CleanupRevokedTokensConfig = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable revoked tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired revoked tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Revoked tokens cleanup settings');

/**
 * Configuration for OAuth authorization codes cleanup
 */
const CleanupOAuthCodesConfig = z
  .object({
    enabled: z.boolean().default(true).describe('Enable OAuth codes cleanup'),
    consumed_retention: DurationString.default('24h').describe(
      'How long to keep consumed authorization codes for debugging/audit.',
    ),
  })
  .describe('OAuth authorization codes cleanup settings');

/**
 * Configuration for email verification tokens cleanup
 */
const CleanupEmailVerificationsConfig = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable email verification tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired email verification tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Email verification tokens cleanup settings');

/**
 * Configuration for password reset tokens cleanup
 */
const CleanupPasswordResetsConfig = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable password reset tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired password reset tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Password reset tokens cleanup settings');

/**
 * Configuration for deleted users cleanup (permanent deletion)
 */
const CleanupDeletedUsersConfig = z
  .object({
    enabled: z.boolean().default(true).describe('Enable deleted users cleanup'),
    retention: DurationString.default('30d').describe(
      'How long to retain soft-deleted users before permanent deletion.',
    ),
  })
  .describe('Deleted users cleanup settings');

/**
 * Configuration for pending OAuth registrations cleanup
 */
const CleanupPendingOAuthRegistrationsConfig = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable pending OAuth registrations cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired pending OAuth registrations. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Pending OAuth registrations cleanup settings');

/**
 * Configuration for JWT key rotation
 */
const CleanupJwtKeysConfig = z
  .object({
    enabled: z.boolean().default(true).describe('Enable JWT key rotation'),
  })
  .describe('JWT key rotation settings');

/**
 * Default cleanup configuration
 */
const DEFAULT_CLEANUP_CONFIG = {
  revoked_tokens: {
    enabled: true,
    retention: '0',
  },
  oauth_codes: {
    enabled: true,
    consumed_retention: '24h',
  },
  email_verifications: {
    enabled: true,
    retention: '0',
  },
  password_resets: {
    enabled: true,
    retention: '0',
  },
  deleted_users: {
    enabled: true,
    retention: '30d',
  },
  pending_oauth_registrations: {
    enabled: true,
    retention: '0',
  },
  jwt_keys: {
    enabled: true,
  },
} as const;

/**
 * Cleanup configuration
 *
 * Controls the cleanup behavior for various entities.
 * Run `tinyauth cleanup` to execute all enabled cleanup tasks.
 *
 * For Kubernetes deployments, create a CronJob that runs:
 * `tinyauth cleanup` on a regular schedule (e.g., daily at 2 AM).
 */
const AppConfigCleanup = z
  .object({
    revoked_tokens: CleanupRevokedTokensConfig.default(
      DEFAULT_CLEANUP_CONFIG.revoked_tokens,
    ),
    oauth_codes: CleanupOAuthCodesConfig.default(
      DEFAULT_CLEANUP_CONFIG.oauth_codes,
    ),
    email_verifications: CleanupEmailVerificationsConfig.default(
      DEFAULT_CLEANUP_CONFIG.email_verifications,
    ),
    password_resets: CleanupPasswordResetsConfig.default(
      DEFAULT_CLEANUP_CONFIG.password_resets,
    ),
    deleted_users: CleanupDeletedUsersConfig.default(
      DEFAULT_CLEANUP_CONFIG.deleted_users,
    ),
    pending_oauth_registrations: CleanupPendingOAuthRegistrationsConfig.default(
      DEFAULT_CLEANUP_CONFIG.pending_oauth_registrations,
    ),
    jwt_keys: CleanupJwtKeysConfig.default(DEFAULT_CLEANUP_CONFIG.jwt_keys),
  })
  .describe('Cleanup configuration for maintenance tasks');

export type AppConfigCleanup = z.infer<typeof AppConfigCleanup>;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log level values.
 * Maps to pino log levels.
 */
const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Log format values.
 * - 'json': Structured JSON output (default)
 * - 'pretty': Human-readable pretty-printed output
 */
const LOG_FORMATS = ['json', 'pretty'] as const;

export type LogFormat = (typeof LOG_FORMATS)[number];

/**
 * Default logging configuration.
 */
export const DEFAULT_LOGGING_CONFIG = {
  level: 'info',
  format: 'json',
  http_log_proxy: false,
} as const;

/**
 * Logging configuration schema.
 *
 * Controls the log level and output format.
 * Configured via config file only (no environment variable override).
 */
export const AppConfigLogging = z
  .object({
    level: z
      .enum(LOG_LEVELS)
      .default(DEFAULT_LOGGING_CONFIG.level)
      .describe('Log level.'),
    format: z
      .enum(LOG_FORMATS)
      .default(DEFAULT_LOGGING_CONFIG.format)
      .describe(
        'Log output format. ' +
          '"json" outputs structured JSON (default). ' +
          '"pretty" outputs human-readable format.',
      ),
    http_log_proxy: z
      .boolean()
      .default(DEFAULT_LOGGING_CONFIG.http_log_proxy)
      .describe(
        'Whether to log HTTP access logs for proxied frontend requests ' +
          'in development mode. When false (default), proxy requests ' +
          'are completely suppressed, keeping the terminal clean. ' +
          'Set to true to see them.',
      ),
  })
  .describe('Logging configuration');

export type AppConfigLogging = z.infer<typeof AppConfigLogging>;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

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

export type AppTheme = z.infer<typeof AppTheme>;

export const AppConfigApp = z.object({
  host: z.string().default('http://localhost:8080'),
  port: zz.PORT.default(8080),
  cookie_secret: z.string().min(16),
  jwt_access_token_ttl: zz
    .coerceInt()
    .pipe(z.number().int().min(60))
    .default(3600), // 1 hour
  jwt_refresh_token_ttl: zz
    .coerceInt()
    .pipe(z.number().int().min(3600))
    .default(2592000), // 30 days
  // JWT Key Rotation Settings (RS256)
  jwt_key_rotation_enabled: zz.COERCE_BOOLEAN.default(true).describe(
    'Enable automatic JWT key rotation',
  ),
  jwt_key_rotation_days: zz
    .coerceInt()
    .pipe(z.number().int().min(1))
    .default(30)
    .describe('Days between key rotations'),
  jwt_key_overlap_days: zz
    .coerceInt()
    .pipe(z.number().int().min(1))
    .default(7)
    .describe('Days to keep previous keys valid after rotation'),
  allowed_signup_emails: z
    .array(z.string())
    .default([])
    .describe(
      'Email patterns allowed for signup. ' +
        '"*" allows all emails, "*@domain.com" allows a specific domain, ' +
        '"user@domain.com" allows a specific email. ' +
        'Empty array disables signup entirely.',
    ),
  supported_languages: z
    .array(LocaleSchema)
    .default([...AVAILABLE_LOCALES])
    .describe(
      `Supported languages. Must be a subset of available locales: ${AVAILABLE_LOCALES.join(', ')}`,
    ),
  default_language: z
    .union([z.literal('auto'), LocaleSchema])
    .default('auto')
    .describe(
      `Default language. Use 'auto' to detect from browser, or specify a locale: ${AVAILABLE_LOCALES.join(', ')}`,
    ),
  fallback_language: LocaleSchema.default(DEFAULT_LOCALE).describe(
    `Fallback language when requested locale is unavailable. Must be one of: ${AVAILABLE_LOCALES.join(', ')}`,
  ),

  light_theme: AppTheme.default('light').describe('Light theme name'),
  dark_theme: AppTheme.default('dark').describe('Dark theme name'),
  theme_mode: z
    .enum(['light', 'dark', 'system'])
    .default('system')
    .describe('Default theme mode'),
  background_url: z
    .url()
    .default(
      'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
    )
    .describe('Background image URL for authentication pages'),
  trust_proxy: z
    .union([
      z.boolean(),
      z.string(),
      z.array(z.string()),
      z.number().int().min(0),
    ])
    .default(false)
    .transform((val) => {
      if (typeof val === 'string') {
        if (val === 'true') return true;
        if (val === 'false') return false;
        const num = Number(val);
        if (!Number.isNaN(num) && String(num) === val) return num;
      }
      return val;
    })
    .describe(
      'Trust proxy configuration for X-Forwarded-* headers. ' +
        'Can be true (trust all), false (trust none), ' +
        'IP/CIDR string, array of IPs, or number (nth hop)',
    ),
  signup_implicit_terms: z
    .record(z.string(), z.string())
    .default({})
    .describe(
      'Localized notice text for implicit consent terms during signup. ' +
        'Keyed by language code (e.g., "en", "ko"). ' +
        'Displayed when any term has consent_mode: "implicit".',
    ),
  icon_url: z
    .url()
    .optional()
    .describe('Icon/logo URL displayed on authentication pages'),
  title: z
    .record(z.string(), z.string())
    .default({
      ko: 'Tinyauth',
      en: 'Tinyauth',
      ja: 'Tinyauth',
    })
    .describe(
      'Localized title text for login page. ' +
        'Keyed by language code (e.g., "en", "ko"). ' +
        'Overrides the default i18n login title.',
    ),
  subtitle: z
    .record(z.string(), z.string())
    .default({
      ko: '가볍고 빠른 인증 솔루션',
      en: 'Lightweight identity provider for your apps',
      ja: '軽量でシンプルな認証ソリューション',
    })
    .describe(
      'Localized subtitle text for login page. ' +
        'Keyed by language code (e.g., "en", "ko"). ' +
        'Overrides the default i18n login subtitle.',
    ),
  account_deletion: zz.COERCE_BOOLEAN.default(false).describe(
    'Whether users can delete their own accounts',
  ),
});

export type AppConfigApp = z.infer<typeof AppConfigApp>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Second factor configuration for password authentication.
 * Determines if users must set up 2FA after registration.
 */
const AppConfigSecondFactor = z.object({
  /**
   * Whether a second factor is required for password authentication.
   * If true, users must set up at least one 2FA method (TOTP or passkey).
   */
  required: z.boolean().default(false),
});

export type AppConfigSecondFactor = z.infer<typeof AppConfigSecondFactor>;

export const AppConfigPasswordPolicy = z
  .object({
    min_length: z
      .number()
      .int()
      .min(1)
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_MIN_LENGTH),
    max_length: z
      .number()
      .int()
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_MAX_LENGTH),
  })
  .superRefine((value, ctx) => {
    if (value.min_length > value.max_length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_length'],
        message: 'max_length must be greater than or equal to min_length',
      });
    }
  });

export type AppConfigPasswordPolicy = z.infer<typeof AppConfigPasswordPolicy>;

/**
 * Password authentication configuration (fixed type).
 */
export const AppConfigPasswordAuth = z.object({
  enabled: z.boolean().default(true),
  email_verification: z.boolean().default(true),
  /**
   * Second factor requirement configuration.
   * Controls whether users must set up 2FA after registration.
   */
  second_factor: AppConfigSecondFactor.default({
    required: false,
  }),
  totp: z
    .object({
      enabled: z.boolean().default(false),
      issuer: z.string().default('Tinyrack'),
    })
    .default({
      enabled: false,
      issuer: 'Tinyrack',
    }),
  policy: AppConfigPasswordPolicy.default({
    min_length: PASSWORD_POLICY_MIN_LENGTH,
    max_length: PASSWORD_POLICY_MAX_LENGTH,
  }),
});

export type AppConfigPasswordAuth = z.infer<typeof AppConfigPasswordAuth>;

const DEFAULT_PASSWORD_POLICY: AppConfigPasswordPolicy = {
  min_length: PASSWORD_POLICY_MIN_LENGTH,
  max_length: PASSWORD_POLICY_MAX_LENGTH,
};

/**
 * Domain regex for WebAuthn rpId validation.
 * Allows:
 * - localhost (for development)
 * - Valid domain names (e.g., example.com, auth.example.com)
 * Rejects:
 * - URLs with protocol (http://, https://)
 * - Domains with port (:8080)
 */
const rpIdDomainRegex =
  /^(?!.*:\/\/)(?!.*:\d)(localhost|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+)$/;

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const AppConfigPasskeyAuth = z.object({
  enabled: z.boolean().default(false),
  email_verification: z.boolean().default(true),
  /**
   * WebAuthn Relying Party ID (domain only, no protocol or port).
   * Must be current domain or a registrable parent domain.
   * If not specified, extracted from app.host hostname.
   * Use parent domain to share passkeys across subdomains.
   * Example: "example.com" or "localhost"
   */
  rp_id: z
    .string()
    .regex(
      rpIdDomainRegex,
      'rp_id must be a valid domain without protocol or port ' +
        '(e.g., "example.com" or "localhost")',
    )
    .optional(),
  /**
   * Allowed origins for WebAuthn verification.
   * If not specified, uses app.host.
   * Example: ["https://auth.example.com", "https://app.example.com"]
   */
  origins: z.array(z.url()).optional(),
});

export type AppConfigPasskeyAuth = z.infer<typeof AppConfigPasskeyAuth>;

/**
 * Authentication methods configuration (fixed structure).
 * Contains password and passkey authentication settings.
 */
const AppConfigAuth = z.object({
  password: AppConfigPasswordAuth.default({
    enabled: true,
    email_verification: true,
    second_factor: {
      required: false,
    },
    totp: {
      enabled: false,
      issuer: 'Tinyrack',
    },
    policy: DEFAULT_PASSWORD_POLICY,
  }),
  passkey: AppConfigPasskeyAuth.default({
    enabled: false,
    email_verification: true,
  }),
});

export type AppConfigAuth = z.infer<typeof AppConfigAuth>;

const AppConfigSecurity = z
  .object({
    hash_master_secret: z
      .string()
      .min(1)
      .superRefine((value, ctx) => {
        try {
          const decoded = fromBase64Url(value);
          if (decoded.length !== 32) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'hash_master_secret must be a base64url-encoded 32-byte secret',
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'hash_master_secret must be a valid base64url-encoded secret',
          });
        }
      }),
    pbkdf2_iterations: z.number().int().min(1).default(600000),
  })
  .strict();

export type AppConfigSecurity = z.infer<typeof AppConfigSecurity>;

// ---------------------------------------------------------------------------
// Identity Providers
// ---------------------------------------------------------------------------

/**
 * GitHub OAuth provider schema.
 * Uses pre-configured endpoints from WELL_KNOWN_OAUTH_PROVIDERS.
 */
const GithubOAuthSchema = z.object({
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
const GoogleOAuthSchema = z.object({
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
const AppleOAuthSchema = z.object({
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
const GenericOAuthSchema = z.object({
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
 * Identity provider configuration.
 * Discriminated union based on 'type' field.
 * Well-known providers (github, google, apple) use pre-configured endpoints.
 * Generic OAuth requires all endpoints to be specified.
 */
const AppConfigIdentityProvider = z.discriminatedUnion('type', [
  GithubOAuthSchema,
  GoogleOAuthSchema,
  AppleOAuthSchema,
  GenericOAuthSchema,
]);

export type AppConfigIdentityProvider = z.infer<
  typeof AppConfigIdentityProvider
>;

/**
 * Identity providers configuration.
 * Array of external OAuth/OIDC provider configurations for social login.
 */
const AppConfigIdentityProviders = z
  .array(AppConfigIdentityProvider)
  .default([]);

export type AppConfigIdentityProviders = z.infer<
  typeof AppConfigIdentityProviders
>;

// ---------------------------------------------------------------------------
// Root (top-level config)
// ---------------------------------------------------------------------------

/**
 * Unified application configuration schema.
 *
 * This schema defines the structure for both user input (config.yaml)
 * and parsed configuration. The SMTP field supports a `{ test: true }`
 * shorthand that gets resolved to actual SMTP credentials at runtime.
 */
export const AppConfigSchema = z
  .object({
    app: AppConfigApp,
    database: AppConfigDatabase.default({
      type: 'sqlite',
      path: './test.db',
      test: false,
    }),
    logging: AppConfigLogging.default(DEFAULT_LOGGING_CONFIG),
    auth: AppConfigAuth.default({
      password: {
        enabled: true,
        email_verification: true,
        second_factor: {
          required: false,
        },
        totp: {
          enabled: false,
          issuer: '',
        },
        policy: DEFAULT_PASSWORD_POLICY,
      },
      passkey: {
        enabled: false,
        email_verification: true,
      },
    }),
    identity_providers: AppConfigIdentityProviders.default([]),
    security: AppConfigSecurity,
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
    cleanup: AppConfigCleanup.default(DEFAULT_CLEANUP_CONFIG),
    scheduler: AppConfigScheduler.default(DEFAULT_SCHEDULER_CONFIG),
    terms: AppConfigTerms.default([]),
    clients: z.array(AppConfigClient).default([]),
    users: z.array(AppConfigUser).default([]),
  })
  .superRefine((config, ctx) => {
    for (const [index, user] of config.users.entries()) {
      const error = getPasswordPolicyError(
        user.password,
        config.auth.password.policy,
      );

      if (!error) {
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['users', index, 'password'],
        message: error,
      });
    }
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
