import z from 'zod';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from '#backend/lib/locale.js';
import { zz } from '#backend/schemas/provider.js';

/**
 * Zod schema for locale validation.
 * Validates that a string is one of the available locales.
 */
const LocaleSchema = z.enum(AVAILABLE_LOCALES);

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
