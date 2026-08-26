import z from 'zod';

export const BRANDING_CONFIG_DEFAULT = {
  title: {
    ko: 'Issuary',
    en: 'Issuary',
    ja: 'Issuary',
  } as Record<string, string>,
} as const;

export const BrandingConfigSchema = z
  .object({
    icon_url: z
      .url()
      .optional()
      .describe('Logo icon URL displayed on the login page.'),
    title: z
      .record(z.string(), z.string())
      .default(BRANDING_CONFIG_DEFAULT.title)
      .describe('Localized title text keyed by language code.'),
  })
  .strict()
  .default(BRANDING_CONFIG_DEFAULT)
  .describe('Branding and visual customization configuration.');

export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
