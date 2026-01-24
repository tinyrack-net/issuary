import z from 'zod/v4';

/**
 * Localized content for a term item.
 * Each language code maps to a title and either a URL or body content.
 */
const TermsLocalizedContent = z
  .object({
    title: z.string().min(1).describe('Display title for the term'),
    url: z.url().optional().describe('URL to the full terms document'),
    body: z
      .string()
      .optional()
      .describe('Inline body content (used if url is not provided)'),
  })
  .describe('Localized content for a term');

export type TermsLocalizedContent = z.infer<typeof TermsLocalizedContent>;

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
      .default(true)
      .describe('Whether agreement to this term is mandatory'),
    always_explicit: z
      .boolean()
      .default(false)
      .describe('If true, always show checkbox even in implicit consent mode'),
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
 * Localized implicit consent notice.
 */
const ImplicitNotice = z
  .record(z.string(), z.string())
  .describe(
    'Localized implicit consent notice keyed by language code. ' +
      'Displayed when consent_mode is "implicit".',
  );

/**
 * Terms configuration schema.
 */
export const AppConfigTerms = z
  .object({
    consent_mode: z
      .enum(['explicit', 'implicit'])
      .default('explicit')
      .describe(
        'Consent collection mode: ' +
          '"explicit" shows checkboxes for each term, ' +
          '"implicit" displays a notice that signup implies agreement',
      ),
    implicit_notice: ImplicitNotice.optional().describe(
      'Localized notice text for implicit consent mode',
    ),
    global: z
      .array(TermsItem)
      .default([])
      .describe('Global terms that apply to all users of the OIDC provider'),
  })
  .describe('Terms of service configuration');

export type AppConfigTerms = z.infer<typeof AppConfigTerms>;
