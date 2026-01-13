import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';

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
