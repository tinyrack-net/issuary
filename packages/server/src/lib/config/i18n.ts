import z from 'zod';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, type Locale } from '../locale.ts';

export const LocaleSchema = z.enum(AVAILABLE_LOCALES);

export const I18N_CONFIG_DEFAULT = {
  supported_languages: [...AVAILABLE_LOCALES] as Locale[],
  default_language: 'auto',
  fallback_language: DEFAULT_LOCALE,
} as const;

export const I18nConfigSchema = z
  .object({
    supported_languages: z
      .array(LocaleSchema)
      .default(I18N_CONFIG_DEFAULT.supported_languages)
      .describe(
        `Supported languages. Must be a subset of: ${AVAILABLE_LOCALES.join(', ')}`,
      ),
    default_language: z
      .union([z.literal('auto'), LocaleSchema])
      .default(I18N_CONFIG_DEFAULT.default_language)
      .describe(
        `Default language. Use "auto" or one of: ${AVAILABLE_LOCALES.join(', ')}`,
      ),
    fallback_language: LocaleSchema.default(
      I18N_CONFIG_DEFAULT.fallback_language,
    ).describe(
      `Fallback language. Must be one of: ${AVAILABLE_LOCALES.join(', ')}`,
    ),
  })
  .strict()
  .default(I18N_CONFIG_DEFAULT);

export type I18nConfig = z.infer<typeof I18nConfigSchema>;
