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
    light_theme: AppThemeSchema.default(BRANDING_CONFIG_DEFAULT.light_theme),
    dark_theme: AppThemeSchema.default(BRANDING_CONFIG_DEFAULT.dark_theme),
    theme_mode: z
      .enum(['light', 'dark', 'system'])
      .default(BRANDING_CONFIG_DEFAULT.theme_mode),
    background_url: z.url().default(BRANDING_CONFIG_DEFAULT.background_url),
    icon_url: z.url().optional(),
    title: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.title),
    subtitle: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.subtitle),
  })
  .strict()
  .default(BRANDING_CONFIG_DEFAULT);

export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
