import z from 'zod/v4';

/**
 * Content type for terms content.
 * - 'link': Content is a URL to external document
 * - 'text': Content is inline text
 */

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
      .optional()
      .default(true)
      .describe('Whether agreement to this term is mandatory'),
    consent_mode: z
      .enum(['explicit', 'implicit'])
      .optional()
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
      .describe('Localized content keyed by language code (e.g., "en", "ko")'),
  })
  .describe('Individual term configuration');

export type TermsItem = z.infer<typeof TermsItem>;

/**
 * Terms configuration schema.
 */
export const AppConfigTerms = z
  .array(TermsItem)
  .default([])
  .describe('Terms of service configuration');

export type AppConfigTerms = z.infer<typeof AppConfigTerms>;
