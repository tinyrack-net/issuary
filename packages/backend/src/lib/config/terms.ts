import z from 'zod';

/**
 * Localized content for a term item.
 * Each language code maps to a title, type, and content.
 * Type determines how the content should be interpreted.
 */
const TermsLocalizedContentLinkSchema = z.object({
  title: z.string().min(1).describe('Display title for the term'),
  type: z.literal('link').describe('Content type: link to external document'),
  content: z.url().describe('URL to the full terms document'),
});

const TermsLocalizedContentTextSchema = z.object({
  title: z.string().min(1).describe('Display title for the term'),
  type: z.literal('text').describe('Content type: inline text'),
  content: z.string().min(1).describe('Inline text content'),
});

const TermsLocalizedContentSchema = z
  .union([TermsLocalizedContentLinkSchema, TermsLocalizedContentTextSchema])
  .describe('Localized content for a term');

const TERMS_ITEM_CONFIG_DEFAULT: {
  required: boolean;
  consent_mode: 'explicit' | 'implicit';
  content: Record<string, z.infer<typeof TermsLocalizedContentSchema>>;
} = {
  required: true,
  consent_mode: 'explicit',
  content: {},
};

/**
 * Individual term item configuration.
 */
export const TermsItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric with - or _')
      .describe('Unique identifier for the term'),
    required: z
      .boolean()
      .default(TERMS_ITEM_CONFIG_DEFAULT.required)
      .describe('Whether agreement to this term is mandatory'),
    consent_mode: z
      .enum(['explicit', 'implicit'])
      .default(TERMS_ITEM_CONFIG_DEFAULT.consent_mode)
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
      .record(z.string(), TermsLocalizedContentSchema)
      .default(TERMS_ITEM_CONFIG_DEFAULT.content)
      .describe(
        'Localized content keyed by language code (e.g., "en", "ko"). ' +
          'Can be omitted for implicit consent terms where content is not displayed.',
      ),
  })
  .describe('Individual term configuration');

export type TermsItem = z.infer<typeof TermsItemSchema>;

export const TERMS_CONFIG_DEFAULT: TermsItem[] = [];

/**
 * Terms configuration schema.
 */
export const TermsConfigSchema = z
  .array(TermsItemSchema)
  .default(TERMS_CONFIG_DEFAULT)
  .describe('Terms of service configuration');

export type TermsConfig = z.infer<typeof TermsConfigSchema>;
