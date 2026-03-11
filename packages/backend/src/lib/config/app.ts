import z from 'zod';
import {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from '#backend/lib/locale.js';
import { zz } from '#backend/schemas/provider.js';

/**
 * Zod schema for locale validation.
 * Validates that a string is one of the available locales.
 */
export const LocaleSchema = z.enum(AVAILABLE_LOCALES);

export const AppThemeSchema = z.enum([
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

export type AppTheme = z.infer<typeof AppThemeSchema>;

export const APP_CONFIG_DEFAULT = {
  host: `http://localhost:8080`,
  port: 8080,
  jwt_access_token_ttl: 3600,
  jwt_refresh_token_ttl: 2592000,
  jwt_key_rotation_enabled: true,
  jwt_key_rotation_days: 30,
  jwt_key_overlap_days: 7,
  allowed_signup_emails: [] as string[],
  supported_languages: [...AVAILABLE_LOCALES] as Locale[],
  default_language: 'auto',
  fallback_language: DEFAULT_LOCALE,
  light_theme: 'light',
  dark_theme: 'dark',
  theme_mode: 'system',
  background_url:
    'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
  trust_proxy: false,
  signup_implicit_terms: {} as Record<string, string>,
  title: {
    ko: 'Tinyauth',
    en: 'Tinyauth',
    ja: 'Tinyauth',
  } as Record<string, string>,
  subtitle: {
    ko: '가볍고 빠른 인증 솔루션',
    en: 'Lightweight identity provider for your apps',
    ja: '軽量でシンプルな認証ソリューション',
  } as Record<string, string>,
  account_deletion: false,
} as const;

export const AppConfigSchema = z.object({
  host: z.string().default(APP_CONFIG_DEFAULT.host),
  port: zz.PORT.default(APP_CONFIG_DEFAULT.port),
  jwt_access_token_ttl: zz
    .coerceInt()
    .pipe(z.number().int().min(60))
    .default(APP_CONFIG_DEFAULT.jwt_access_token_ttl), // 1 hour
  jwt_refresh_token_ttl: zz
    .coerceInt()
    .pipe(z.number().int().min(3600))
    .default(APP_CONFIG_DEFAULT.jwt_refresh_token_ttl), // 30 days
  // JWT Key Rotation Settings (RS256)
  jwt_key_rotation_enabled: zz.COERCE_BOOLEAN.default(
    APP_CONFIG_DEFAULT.jwt_key_rotation_enabled,
  ).describe('Enable automatic JWT key rotation'),
  jwt_key_rotation_days: zz
    .coerceInt()
    .pipe(z.number().int().min(1))
    .default(APP_CONFIG_DEFAULT.jwt_key_rotation_days)
    .describe('Days between key rotations'),
  jwt_key_overlap_days: zz
    .coerceInt()
    .pipe(z.number().int().min(1))
    .default(APP_CONFIG_DEFAULT.jwt_key_overlap_days)
    .describe('Days to keep previous keys valid after rotation'),
  allowed_signup_emails: z
    .array(z.string())
    .default(APP_CONFIG_DEFAULT.allowed_signup_emails)
    .describe(
      'Email patterns allowed for signup. ' +
        '"*" allows all emails, "*@domain.com" allows a specific domain, ' +
        '"user@domain.com" allows a specific email. ' +
        'Empty array disables signup entirely.',
    ),
  supported_languages: z
    .array(LocaleSchema)
    .default(APP_CONFIG_DEFAULT.supported_languages)
    .describe(
      `Supported languages. Must be a subset of available locales: ${AVAILABLE_LOCALES.join(', ')}`,
    ),
  default_language: z
    .union([z.literal('auto'), LocaleSchema])
    .default(APP_CONFIG_DEFAULT.default_language)
    .describe(
      `Default language. Use 'auto' to detect from browser, or specify a locale: ${AVAILABLE_LOCALES.join(', ')}`,
    ),
  fallback_language: LocaleSchema.default(
    APP_CONFIG_DEFAULT.fallback_language,
  ).describe(
    `Fallback language when requested locale is unavailable. Must be one of: ${AVAILABLE_LOCALES.join(', ')}`,
  ),

  light_theme: AppThemeSchema.default(APP_CONFIG_DEFAULT.light_theme).describe(
    'Light theme name',
  ),
  dark_theme: AppThemeSchema.default(APP_CONFIG_DEFAULT.dark_theme).describe(
    'Dark theme name',
  ),
  theme_mode: z
    .enum(['light', 'dark', 'system'])
    .default(APP_CONFIG_DEFAULT.theme_mode)
    .describe('Default theme mode'),
  background_url: z
    .url()
    .default(APP_CONFIG_DEFAULT.background_url)
    .describe('Background image URL for authentication pages'),
  trust_proxy: z
    .union([
      z.boolean(),
      z.string(),
      z.array(z.string()),
      z.number().int().min(0),
    ])
    .default(APP_CONFIG_DEFAULT.trust_proxy)
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
    .default(APP_CONFIG_DEFAULT.signup_implicit_terms)
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
    .default(APP_CONFIG_DEFAULT.title)
    .describe(
      'Localized title text for login page. ' +
        'Keyed by language code (e.g., "en", "ko"). ' +
        'Overrides the default i18n login title.',
    ),
  subtitle: z
    .record(z.string(), z.string())
    .default(APP_CONFIG_DEFAULT.subtitle)
    .describe(
      'Localized subtitle text for login page. ' +
        'Keyed by language code (e.g., "en", "ko"). ' +
        'Overrides the default i18n login subtitle.',
    ),
  account_deletion: zz.COERCE_BOOLEAN.default(
    APP_CONFIG_DEFAULT.account_deletion,
  ).describe('Whether users can delete their own accounts'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
