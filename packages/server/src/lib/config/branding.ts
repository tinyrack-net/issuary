import z from 'zod';

export const BRANDING_CONFIG_DEFAULT = {
  title: {
    ko: 'Issuary',
    en: 'Issuary',
    ja: 'Issuary',
  } as Record<string, string>,
  subtitle: {
    ko: '만나서 반가워요!',
    en: 'Nice to meet you!',
    ja: 'はじめまして！',
  } as Record<string, string>,
  login_method_description: {
    ko: '원하는 방식으로 로그인하세요.',
    en: "Choose how you'd like to sign in.",
    ja: 'お好きな方法でログインしてください。',
  } as Record<string, string>,
} as const;

export const BrandingConfigSchema = z
  .object({
    icon_url: z
      .url()
      .optional()
      .describe('App icon URL displayed on authentication pages.'),
    logo_url: z
      .url()
      .optional()
      .describe('Logo URL that replaces the app icon and title.'),
    title: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.title)
      .describe('Localized title text keyed by language code.'),
    subtitle: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.subtitle)
      .describe('Localized login subtitle keyed by language code.'),
    login_method_description: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.login_method_description)
      .describe('Localized login method guidance keyed by language code.'),
  })
  .strict()
  .default(BRANDING_CONFIG_DEFAULT)
  .describe('Branding and visual customization configuration.');

export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
