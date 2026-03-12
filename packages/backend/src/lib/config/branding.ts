import z from 'zod';

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

export const BRANDING_CONFIG_DEFAULT = {
  light_theme: 'light',
  dark_theme: 'dark',
  theme_mode: 'system',
  background_url:
    'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
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
} as const;

export const BrandingConfigSchema = z
  .object({
    light_theme: AppThemeSchema.default(
      BRANDING_CONFIG_DEFAULT.light_theme,
    ).describe('DaisyUI theme used in light mode.'),
    dark_theme: AppThemeSchema.default(
      BRANDING_CONFIG_DEFAULT.dark_theme,
    ).describe('DaisyUI theme used in dark mode.'),
    theme_mode: z
      .enum(['light', 'dark', 'system'])
      .default(BRANDING_CONFIG_DEFAULT.theme_mode)
      .describe('Theme mode. "system" follows the user\'s OS preference.'),
    background_url: z
      .url()
      .default(BRANDING_CONFIG_DEFAULT.background_url)
      .describe('Background image URL for the login page.'),
    icon_url: z
      .url()
      .optional()
      .describe('Logo icon URL displayed on the login page.'),
    title: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.title)
      .describe('Localized title text keyed by language code.'),
    subtitle: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.subtitle)
      .describe('Localized subtitle text keyed by language code.'),
  })
  .strict()
  .default(BRANDING_CONFIG_DEFAULT)
  .describe('Branding and visual customization configuration.');

export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
